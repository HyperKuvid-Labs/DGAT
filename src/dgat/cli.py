"""DGAT CLI"""

import os
import sys
import subprocess
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from dgat import __version__
from dgat.config import load_config, save_config, get_config_dir
from dgat.scanner import (
    get_binary_path,
    run_scan,
    run_update,
    load_file_tree,
    load_dep_graph,
    load_blueprint,
    get_file_description,
    get_dependencies,
    get_dependents,
    search_files,
)


console = Console()


@click.group()
@click.version_option(__version__)
def app():
    """DGAT - Dependency Graph as a Tool"""
    pass


@app.command()
@click.argument("path", default=".")
@click.option(
    "--provider",
    "-p",
    help="LLM provider (vllm, ollama, openai, anthropic, openrouter)",
)
@click.option("--model", "-m", help="Model name")
@click.option("--deps-only", is_flag=True, help="Skip LLM descriptions")
@click.option("--port", default=8090, help="Port for backend server")
def scan(path, provider, model, deps_only, port):
    """Scan a codebase and generate dependency graph"""
    console.print(f"[bold]DGAT v{__version__}[/bold]")
    console.print(f"[dim]Scanning:[/dim] {path}")

    if provider:
        console.print(f"[dim]Provider:[/dim] {provider}")
    if model:
        console.print(f"[dim]Model:[/dim] {model}")

    result = run_scan(path, provider, model, deps_only, port)

    if result.success:
        console.print(
            f"[green]✓[/green] Scan complete: {result.files_scanned} files, {result.edges} edges"
        )
    else:
        console.print(f"[red]✗[/red] Scan failed: {result.message}")
        sys.exit(1)


@app.command()
@click.argument("path", default=".")
def update(path):
    """Incremental update of changed files"""
    console.print(f"[bold]Updating:[/bold] {path}")

    result = run_update(path)

    if result.success:
        console.print("[green]✓[/green] Update complete")
    else:
        console.print(f"[red]✗[/red] Update failed: {result.message}")
        sys.exit(1)


@app.command()
@click.option("--port", default=8090, help="Port for backend server")
def backend(port):
    """Start the API backend server"""
    binary = get_binary_path()

    console.print(f"[bold]Starting DGAT backend on port {port}...[/bold]")

    try:
        subprocess.run([str(binary), "--backend", "--port", str(port)])
    except KeyboardInterrupt:
        console.print("\n[yellow]Backend stopped[/yellow]")


@app.command()
@click.option("--http", is_flag=True, help="Start HTTP server instead of stdio")
@click.option("--port", default=3000, help="Port for HTTP server")
def mcp(http, port):
    """Start the MCP server"""
    from dgat.mcp import main as mcp_main

    if http:
        console.print(f"[bold]Starting DGAT MCP server on port {port}...[/bold]")
        mcp_main(transport="http", port=port)
    else:
        console.print("[bold]Starting DGAT MCP server (stdio)...[/bold]")
        mcp_main(transport="stdio")


@app.group()
def config():
    """Manage DGAT configuration"""
    pass


@config.command("show")
def config_show():
    """Show current configuration"""
    cfg = load_config()

    table = Table(title="DGAT Configuration")
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("default_provider", cfg.default_provider)

    for name, provider in cfg.providers.items():
        table.add_row(f"provider.{name}.endpoint", provider.endpoint or "(not set)")
        table.add_row(f"provider.{name}.model", provider.model or "(not set)")
        table.add_row(
            f"provider.{name}.api_key", "(set)" if provider.api_key else "(not set)"
        )

    console.print(table)


@config.command("set")
@click.argument("key")
@click.argument("value")
def config_set(key, value):
    """Set a configuration value"""
    cfg = load_config()

    if key == "provider" or key == "default_provider":
        cfg.default_provider = value
    elif key.startswith("providers."):
        parts = key.split(".")
        if len(parts) == 2:
            provider_name = parts[1]
            if provider_name not in cfg.providers:
                from dgat.config import ProviderConfig

                cfg.providers[provider_name] = ProviderConfig()
            if value.startswith("http://") or value.startswith("https://"):
                cfg.providers[provider_name].endpoint = value
            else:
                cfg.providers[provider_name].model = value
    elif key == "api_key":
        provider = cfg.default_provider
        if provider not in cfg.providers:
            from dgat.config import ProviderConfig

            cfg.providers[provider] = ProviderConfig()
        cfg.providers[provider].api_key = value
    else:
        console.print(f"[red]Unknown config key: {key}[/red]")
        sys.exit(1)

    save_config(cfg)
    console.print(f"[green]✓[/green] Set {key} = {value}")


@config.command("path")
def config_path():
    """Show configuration file path"""
    console.print(f"[cyan]{get_config_dir() / 'config.json'}[/cyan]")


@app.command()
@click.argument("query")
@click.option("--path", "-p", help="Path to search in")
@click.option("--limit", "-l", default=10, help="Maximum results")
def search(query, path, limit):
    """Search files by name or description"""
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
            result.description[:50] + "..."
            if result.description and len(result.description) > 50
            else result.description or ""
        )
        table.add_row(result.rel_path, f"{result.score:.1f}", desc)

    console.print(table)


@app.command()
@click.argument("rel_path")
@click.option("--path", "-p", help="Path to search in")
def describe(rel_path, path):
    """Get description for a specific file"""
    desc = get_file_description(rel_path, Path(path) if path else None)

    if desc:
        console.print(f"[bold]{rel_path}[/bold]")
        console.print(desc)
    else:
        console.print(f"[yellow]No description found for {rel_path}[/yellow]")


@app.command()
@click.argument("rel_path")
@click.option("--path", "-p", help="Path to search in")
def deps(rel_path, path):
    """Get dependencies for a specific file"""
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
    """Get files that depend on a specific file"""
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
    """Get the architectural blueprint"""
    result = load_blueprint(Path(path) if path else None)

    if result and result.content:
        console.print(result.content)
    else:
        console.print("[yellow]No blueprint found. Run 'dgat scan' first.[/yellow]")


if __name__ == "__main__":
    app()
