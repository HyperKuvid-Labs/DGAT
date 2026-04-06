#!/usr/bin/env python3
"""
Parse raw benchmark output and create clean JSON, then generate PNG chart
"""

import json
import re
import os
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


def parse_raw_benchmark(raw_file):
    """Parse the raw benchmark output file and extract clean JSON data"""

    with open(raw_file, "r") as f:
        content = f.read()

    # Extract JSON objects from the content
    json_pattern = r'\{"name":"[^}]+\}'
    matches = re.findall(json_pattern, content)

    if not matches:
        print("No JSON data found in raw file")
        return None

    results = []
    for match in matches:
        try:
            # Fix the decimal issue - bc outputs .5 instead of 0.5
            fixed = re.sub(r":\s*\.(\d+)", r": 0.\1", match)
            fixed = re.sub(r"\[\.(\d+)", r"[0.\1", fixed)
            fixed = re.sub(r",\s*\.(\d+)", r", 0.\1", fixed)
            data = json.loads(fixed)
            results.append(data)
        except json.JSONDecodeError as e:
            print(f"Error parsing: {e}")
            print(f"Data: {match[:100]}...")
            continue

    if not results:
        return None

    # Extract config from the raw file
    num_runs_match = re.search(r"Configuration:\s*(\d+)\s*runs", content)
    num_runs = int(num_runs_match.group(1)) if num_runs_match else 20

    test_file_match = re.search(r"Test file:\s*([^\n]+)", content)
    test_file = test_file_match.group(1).strip() if test_file_match else ""

    test_concept_match = re.search(r"Test concept:\s*([^\n]+)", content)
    test_concept = test_concept_match.group(1).strip() if test_concept_match else ""

    test_dir_match = re.search(r"Test directory:\s*([^\n]+)", content)
    test_dir = test_dir_match.group(1).strip() if test_dir_match else ""

    return {
        "config": {
            "num_runs": num_runs,
            "test_file": test_file,
            "test_concept": test_concept,
            "test_dir": test_dir,
        },
        "results": results,
    }


def create_performance_chart(data, output_file):
    """Create a PNG performance comparison chart from benchmark results"""

    results = data["results"]
    config = data["config"]

    tasks = []
    dgat_times = []
    opencode_times = []
    speedups = []

    for result in results:
        tasks.append(result["name"])
        dgat_times.append(result["dgat_avg"])
        opencode_times.append(result["opencode_avg"])
        speedups.append(result["speedup"])

    # Set up the figure with 3 subplots
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(14, 16))

    # Chart 1: Bar chart comparing times (linear scale)
    x = np.arange(len(tasks))
    width = 0.35

    bars1 = ax1.bar(
        x - width / 2,
        dgat_times,
        width,
        label="DGAT",
        color="#2196F3",
        edgecolor="#1565C0",
        linewidth=1.2,
    )
    bars2 = ax1.bar(
        x + width / 2,
        opencode_times,
        width,
        label="Opencode Native",
        color="#F44336",
        edgecolor="#C62828",
        linewidth=1.2,
    )

    ax1.set_xlabel("Benchmark Tasks", fontsize=12, fontweight="bold")
    ax1.set_ylabel("Average Time (seconds)", fontsize=12, fontweight="bold")
    ax1.set_title(
        "DGAT vs Opencode Native Tools: Average Execution Time\n(20 runs per task)",
        fontsize=14,
        fontweight="bold",
    )
    ax1.set_xticks(x)
    ax1.set_xticklabels(
        [task.replace(" ", "\n") for task in tasks], rotation=0, ha="center", fontsize=9
    )
    ax1.legend(fontsize=11)
    ax1.grid(True, alpha=0.3, axis="y")

    # Add value labels on bars
    for bar in bars1:
        height = bar.get_height()
        ax1.annotate(
            f"{height:.4f}s",
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, 3),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=7,
        )

    for bar in bars2:
        height = bar.get_height()
        ax1.annotate(
            f"{height:.4f}s",
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, 3),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=7,
        )

    # Chart 2: Speedup chart (log scale)
    colors = ["#4CAF50" if s > 1 else "#F44336" for s in speedups]
    bars3 = ax2.bar(
        x, speedups, color=colors, alpha=0.8, edgecolor="black", linewidth=1.2
    )

    ax2.axhline(
        y=1, color="black", linestyle="--", alpha=0.5, linewidth=2, label="Parity (1x)"
    )
    ax2.set_xlabel("Benchmark Tasks", fontsize=12, fontweight="bold")
    ax2.set_ylabel(
        "Speedup Factor (Opencode Time / DGAT Time)", fontsize=12, fontweight="bold"
    )
    ax2.set_title(
        "Performance Speedup: DGAT vs Opencode Native Tools\n(>1 = DGAT faster, <1 = Opencode faster, log scale)",
        fontsize=14,
        fontweight="bold",
    )
    ax2.set_xticks(x)
    ax2.set_xticklabels(
        [task.replace(" ", "\n") for task in tasks], rotation=0, ha="center", fontsize=9
    )
    ax2.legend(fontsize=11)
    ax2.grid(True, alpha=0.3, axis="y")
    ax2.set_yscale("log")

    # Add value labels on speedup bars
    for bar in bars3:
        height = bar.get_height()
        label_text = f"{height:.2f}x"
        if height >= 1:
            va = "bottom"
            y_offset = 8
        else:
            va = "top"
            y_offset = -8
        ax2.annotate(
            label_text,
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, y_offset),
            textcoords="offset points",
            ha="center",
            va=va,
            fontsize=9,
            fontweight="bold",
        )

    # Chart 3: Win/Loss summary pie chart
    dgat_wins = sum(1 for s in speedups if s > 1)
    opencode_wins = len(speedups) - dgat_wins

    labels = [
        f"DGAT Faster\n({dgat_wins} tasks)",
        f"Opencode Faster\n({opencode_wins} tasks)",
    ]
    sizes = [dgat_wins, opencode_wins]
    explode = (0.05, 0.05)
    colors_pie = ["#4CAF50", "#F44336"]

    ax3.pie(
        sizes,
        explode=explode,
        labels=labels,
        colors=colors_pie,
        autopct="%1.1f%%",
        shadow=True,
        startangle=90,
        textprops={"fontsize": 12, "fontweight": "bold"},
    )
    ax3.set_title("Task Win Distribution", fontsize=14, fontweight="bold")

    # Add summary text in the center of the figure
    avg_speedup = np.mean(speedups)
    median_speedup = np.median(speedups)
    max_speedup = max(speedups)
    min_speedup = min(speedups)

    summary_text = (
        f"Summary Statistics\n"
        f"{'=' * 40}\n"
        f"Total Tasks: {len(tasks)}\n"
        f"Runs per Task: {config['num_runs']}\n"
        f"DGAT Wins: {dgat_wins}/{len(tasks)} ({dgat_wins / len(tasks) * 100:.1f}%)\n"
        f"Average Speedup: {avg_speedup:.2f}x\n"
        f"Median Speedup: {median_speedup:.2f}x\n"
        f"Max Speedup: {max_speedup:.2f}x\n"
        f"Min Speedup: {min_speedup:.2f}x"
    )

    fig.text(
        0.98,
        0.5,
        summary_text,
        fontsize=10,
        ha="right",
        va="center",
        fontfamily="monospace",
        bbox=dict(boxstyle="round,pad=0.5", facecolor="lightyellow", alpha=0.8),
    )

    plt.tight_layout(rect=[0, 0, 0.85, 1])
    plt.savefig(output_file, dpi=300, bbox_inches="tight", facecolor="white")
    print(f"Chart saved to: {output_file}")


def generate_summary_text(data, summary_file):
    """Generate a text summary of the benchmark results"""

    results = data["results"]
    config = data["config"]

    tasks = [r["name"] for r in results]
    dgat_times = [r["dgat_avg"] for r in results]
    opencode_times = [r["opencode_avg"] for r in results]
    speedups = [r["speedup"] for r in results]

    dgat_wins = sum(1 for s in speedups if s > 1)
    total_tasks = len(speedups)
    avg_speedup = np.mean(speedups)
    median_speedup = np.median(speedups)

    with open(summary_file, "w") as f:
        f.write("DGAT vs Opencode Native Tools Benchmark Summary\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Configuration:\n")
        f.write(f"  Runs per Task: {config['num_runs']}\n")
        f.write(f"  Test File: {config['test_file']}\n")
        f.write(f"  Test Concept: {config['test_concept']}\n")
        f.write(f"  Test Directory: {config['test_dir']}\n\n")

        f.write("Overall Statistics:\n")
        f.write(f"  Total Tasks Evaluated: {total_tasks}\n")
        f.write(
            f"  Tasks Where DGAT Was Faster: {dgat_wins} ({dgat_wins / total_tasks * 100:.1f}%)\n"
        )
        f.write(
            f"  Tasks Where Opencode Was Faster: {total_tasks - dgat_wins} ({(total_tasks - dgat_wins) / total_tasks * 100:.1f}%)\n"
        )
        f.write(f"  Average Speedup: {avg_speedup:.2f}x\n")
        f.write(f"  Median Speedup: {median_speedup:.2f}x\n")
        f.write(f"  Maximum Speedup: {max(speedups):.2f}x\n")
        f.write(f"  Minimum Speedup: {min(speedups):.2f}x\n\n")

        f.write("Task-by-Task Results:\n")
        f.write("-" * 60 + "\n")
        for i, task in enumerate(tasks):
            winner = "DGAT" if speedups[i] > 1 else "Opencode"
            f.write(f"\n{task}:\n")
            f.write(f"  DGAT Avg Time: {dgat_times[i]:.6f}s\n")
            f.write(f"  Opencode Avg Time: {opencode_times[i]:.6f}s\n")
            f.write(f"  Speedup: {speedups[i]:.2f}x ({winner} faster)\n")

            # Show raw times
            if "dgat_times" in results[i]:
                f.write(
                    f"  DGAT Raw Times: {', '.join([f'{t:.4f}' for t in results[i]['dgat_times'][:5]])}...\n"
                )
            if "opencode_times" in results[i]:
                f.write(
                    f"  Opencode Raw Times: {', '.join([f'{t:.4f}' for t in results[i]['opencode_times'][:5]])}...\n"
                )


if __name__ == "__main__":
    raw_file = (
        "/home/pradheep/DGAT/benchmark/results/benchmark_results_20260406_113758.json"
    )
    output_chart = "/home/pradheep/DGAT/benchmark/performance_chart.png"
    output_summary = "/home/pradheep/DGAT/benchmark/performance_chart_summary.txt"

    if os.path.exists(raw_file):
        data = parse_raw_benchmark(raw_file)
        if data:
            create_performance_chart(data, output_chart)
            generate_summary_text(data, output_summary)
            print(f"Summary saved to: {output_summary}")
        else:
            print("Failed to parse benchmark data")
    else:
        print(f"Raw results file not found: {raw_file}")
