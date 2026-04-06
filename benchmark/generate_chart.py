#!/usr/bin/env python3
"""
Generate a simple text-based chart from benchmark results
"""

import json
import os


def generate_performance_chart(results_file):
    """Generate a performance comparison chart from benchmark results"""

    # Load results
    with open(results_file, "r") as f:
        data = json.load(f)

    # Extract results
    results = data["results"]

    # Prepare data for chart
    tasks = []
    speedups = []

    for result in results:
        tasks.append(result["name"])
        speedups.append(result["speedup"])

    # Create chart
    print("DGAT vs Opencode Native Tools Performance Comparison")
    print("=" * 60)
    print("Speedup Factor (Opencode Time / DGAT Time)")
    print("Higher values = DGAT is faster, Lower values = Opencode is faster")
    print()

    # Find max speedup for scaling
    max_speedup = max(speedups) if speedups else 1
    min_speedup = min(speedups) if speedups else 0.1

    # Print each task with visualization
    for i, (task, speedup) in enumerate(zip(tasks, speedups)):
        # Calculate bar length (log scale for better visualization)
        if speedup >= 1:
            # DGAT is faster
            bar_length = min(40, int(20 * (speedup / max_speedup)) + 1)
            bar = "█" * bar_length + "░" * (40 - bar_length)
            label = f"DGAT faster ({speedup:.2f}x)"
        else:
            # Opencode is faster
            bar_length = min(40, int(20 * ((1 / speedup) / (1 / min_speedup))) + 1)
            bar = "░" * (40 - bar_length) + "█" * bar_length
            label = f"Opencode faster ({1 / speedup:.2f}x)"

        print(f"{task:<35} |{bar}| {label}")

    print()
    print("Legend: █ = Advantage for faster tool, ░ = Advantage for slower tool")
    print()

    # Summary statistics
    dgat_wins = sum(1 for s in speedups if s > 1)
    total_tasks = len(speedups)
    avg_speedup = sum(speedups) / len(speedups) if speedups else 0

    print("Summary Statistics:")
    print(f"- Total Tasks: {total_tasks}")
    print(
        f"- DGAT Wins: {dgat_wins}/{total_tasks} ({dgat_wins / total_tasks * 100:.1f}%)"
    )
    print(f"- Average Speedup: {avg_speedup:.2f}x")
    print(f"- Maximum Speedup: {max_speedup:.2f}x")
    print(f"- Minimum Speedup: {min_speedup:.2f}x")

    if avg_speedup > 1:
        print("- Overall: DGAT is faster on average")
    else:
        print("- Overall: Opencode native tools are faster on average")


if __name__ == "__main__":
    results_file = "/home/pradheep/DGAT/benchmark/results/benchmark_results_20260406_111855_fixed.json"
    if os.path.exists(results_file):
        generate_performance_chart(results_file)
    else:
        print(f"Results file not found: {results_file}")
        print("Available results:")
        results_dir = "/home/pradheep/DGAT/benchmark/results/"
        if os.path.exists(results_dir):
            for f in os.listdir(results_dir):
                if f.endswith(".json"):
                    print(f"  {f}")
