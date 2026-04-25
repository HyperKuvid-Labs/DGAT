"""DGAT CLI — scan, backend, config."""

import sys
import webbrowser
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from dgat import __version__
from dgat.config import (
    load_config,
    save_config,
    get_config_path,
    ProviderConfig,
)
from dgat.scanner import (
    run_scan,
    run_update,
    load_blueprint,
    get_file_description,
    get_dependencies,
    get_dependents,
    search_files,
)


console = Console()


@click.group(invoke_without_command=True)
@click.version_option(__version__)
@click.pass_context
def app(ctx):
    """DGAT — Dependency Graph as a Tool.

    Typical flow:

        dgat scan       # build file_tree.json / dep_graph.json / blueprint.md
        dgat backend    # serve the interactive 3D graph UI

    Running `dgat` with no subcommand is equivalent to `dgat scan .`.
    """
    if ctx.invoked_subcommand is None:
        ctx.invoke(scan, path=".", provider=None, model=None, deps_only=False)


# ---------------------------------------------------------------------------
# scan — produce artifacts only; no server.
# ---------------------------------------------------------------------------
@app.command()
@click.argument("path", default=".")
@click.option(
    "--provider",
    "-p",
    help="LLM provider (vllm, ollama, openai, anthropic, openrouter)",
)
@click.option("--model", "-m", help="Model name")
@click.option("--deps-only", is_flag=True, help="Skip LLM descriptions")
def scan(path, provider, model, deps_only):
    """Scan a codebase and write file_tree.json / dep_graph.json / dgat_blueprint.md."""
    console.print(f"[bold]DGAT v{__version__}[/bold]")
    console.print(f"[dim]Scanning:[/dim] {path}")

    cfg = load_config()
    effective_provider = provider or cfg.default_provider
    effective_model = model or (
        cfg.providers.get(effective_provider, ProviderConfig()).model
    )
    if effective_provider:
        console.print(f"[dim]Provider:[/dim] {effective_provider}")
    if effective_model:
        console.print(f"[dim]Model:[/dim] {effective_model}")

    result = run_scan(path, effective_provider, effective_model, deps_only)

    if result.success:
        console.print(
            f"[green]✓[/green] Scan complete: "
            f"{result.files_scanned} files, {result.edges} edges"
        )
        console.print(
            "[dim]Run[/dim] [cyan]dgat backend[/cyan] [dim]to open the 3D graph.[/dim]"
        )
    else:
        console.print(f"[red]✗[/red] Scan failed: {result.message}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# backend — Python FastAPI server serving the 3D UI.
# ---------------------------------------------------------------------------
@app.command()
@click.argument("path", default=".")
@click.option("--port", default=8090, help="Port to listen on")
@click.option("--host", default="127.0.0.1", help="Host to bind")
@click.option("--no-browser", is_flag=True, help="Don't auto-open the browser")
def backend(path, port, host, no_browser):
    """Serve the interactive 3D graph UI for a scanned project."""
    try:
        from dgat.server import serve
    except ImportError as e:
        console.print(
            "[red]✗[/red] Missing backend deps. Install with: "
            "[cyan]pip install fastapi uvicorn[/cyan]"
        )
        console.print(f"[dim]{e}[/dim]")
        sys.exit(1)

    data_dir = Path(path).resolve()
    if not data_dir.exists():
        console.print(f"[red]✗[/red] Path does not exist: {data_dir}")
        sys.exit(1)

    # Warn (don't block) if scan data is missing — user may just be re-opening the UI.
    if not (data_dir / "file_tree.json").exists():
        console.print(
            f"[yellow]![/yellow] No file_tree.json in {data_dir}. "
            "Run [cyan]dgat scan[/cyan] first or the UI will be empty."
        )

    url = f"http://{host}:{port}"
    console.print(f"[bold]DGAT backend[/bold] — {url}")
    console.print(f"[dim]Serving:[/dim] {data_dir}")
    console.print("[dim]Ctrl+C to stop[/dim]\n")

    if not no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        serve(data_dir, port=port, host=host)
    except KeyboardInterrupt:
        console.print("\n[yellow]Backend stopped[/yellow]")


# ---------------------------------------------------------------------------
# config — single-command view/edit of provider + model + key.
# ---------------------------------------------------------------------------
@app.command()
@click.option("--provider", "-p", help="Set default provider")
@click.option("--model", "-m", help="Set model for the default provider")
@click.option("--api-key", "-k", help="Set API key for the default provider")
@click.option("--endpoint", "-e", help="Set endpoint URL for the default provider")
@click.option("--path", is_flag=True, help="Print the config file path and exit")
def config(provider, model, api_key, endpoint, path):
    """Show or update DGAT config (provider, model, api key, endpoint)."""
    if path:
        console.print(str(get_config_path()))
        return

    cfg = load_config()
    changed = False

    if provider:
        cfg.default_provider = provider
        changed = True

    pname = cfg.default_provider
    if pname not in cfg.providers:
        cfg.providers[pname] = ProviderConfig()

    if model:
        cfg.providers[pname].model = model
        changed = True
    if api_key:
        cfg.providers[pname].api_key = api_key
        changed = True
    if endpoint:
        cfg.providers[pname].endpoint = endpoint
        changed = True

    if changed:
        save_config(cfg)
        console.print("[green]✓[/green] Config saved\n")

    # Always print current config.
    p = cfg.providers.get(cfg.default_provider, ProviderConfig())
    table = Table(title="DGAT config", show_header=False, border_style="dim")
    table.add_column(style="cyan", no_wrap=True)
    table.add_column(style="green")
    table.add_row("provider", cfg.default_provider)
    table.add_row("model", p.model or "[dim](not set)[/dim]")
    table.add_row("endpoint", p.endpoint or "[dim](not set)[/dim]")
    table.add_row("api key", "[green](set)[/green]" if p.api_key else "[dim](not set)[/dim]")
    table.add_row("file", str(get_config_path()))
    console.print(table)


# ---------------------------------------------------------------------------
# Utility commands (kept, small surface)
# ---------------------------------------------------------------------------
@app.command()
@click.argument("path", default=".")
def update(path):
    """Incremental re-scan of changed files."""
    console.print(f"[bold]Updating:[/bold] {path}")
    result = run_update(path)
    if result.success:
        console.print("[green]✓[/green] Update complete")
    else:
        console.print(f"[red]✗[/red] Update failed: {result.message}")
        sys.exit(1)


@app.command()
@click.option("--http", is_flag=True, help="Start HTTP server instead of stdio")
@click.option("--port", default=3000, help="Port for HTTP server")
def mcp(http, port):
    """Start the MCP server."""
    from dgat.mcp import main as mcp_main

    if http:
        console.print(f"[bold]Starting DGAT MCP server on port {port}...[/bold]")
        mcp_main(transport="http", port=port)
    else:
        console.print("[bold]Starting DGAT MCP server (stdio)...[/bold]")
        mcp_main(transport="stdio")


@app.command()
@click.argument("query")
@click.option("--path", "-p", help="Path to search in")
@click.option("--limit", "-l", default=10, help="Maximum results")
def search(query, path, limit):
    """Search files by name or description."""
    results = search_files(query, Path(path) if path else None, limit)
    if not results:
        console.print("[yellow]No results found[/yellow]")
        return

    table = Table(title=f"Search results for '{query}'")
    table.add_column("File", style="cyan")
    table.add_column("Score", style="yellow")
    table.add_column("Description", style="green")
    for result in results:
        desc = (
            result.description[:60] + "..."
            if result.description and len(result.description) > 60
            else result.description or ""
        )
        table.add_row(result.rel_path, f"{result.score:.1f}", desc)
    console.print(table)


@app.command()
@click.argument("rel_path")
@click.option("--path", "-p", help="Path to search in")
def describe(rel_path, path):
    """Get description for a specific file."""
    desc = get_file_description(rel_path, Path(path) if path else None)
    if desc:
        console.print(f"[bold]{rel_path}[/bold]\n{desc}")
    else:
        console.print(f"[yellow]No description found for {rel_path}[/yellow]")


@app.command()
@click.argument("rel_path")
@click.option("--path", "-p", help="Path to search in")
def deps(rel_path, path):
    """Get dependencies for a specific file."""
    deps_list = get_dependencies(rel_path, Path(path) if path else None)
    if deps_list:
        console.print(f"[bold]Dependencies of {rel_path}:[/bold]")
        for d in deps_list:
            console.print(f"  • {d}")
    else:
        console.print(f"[yellow]No dependencies found for {rel_path}[/yellow]")


@app.command()
@click.argument("rel_path")
@click.option("--path", "-p", help="Path to search in")
def dependents(rel_path, path):
    """Get files that depend on a specific file."""
    dependents_list = get_dependents(rel_path, Path(path) if path else None)
    if dependents_list:
        console.print(f"[bold]Dependents of {rel_path}:[/bold]")
        for d in dependents_list:
            console.print(f"  • {d}")
    else:
        console.print(f"[yellow]No dependents found for {rel_path}[/yellow]")


@app.command()
@click.option("--path", "-p", help="Path to load from")
def blueprint(path):
    """Print the architectural blueprint."""
    result = load_blueprint(Path(path) if path else None)
    if result and result.content:
        console.print(result.content)
    else:
        console.print("[yellow]No blueprint found. Run 'dgat scan' first.[/yellow]")


if __name__ == "__main__":
    app()
