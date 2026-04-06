#!/usr/bin/env python3
"""
Benchmark runner for comparing DGAT vs Opencode native tools.
Automates execution of tasks from BENCHMARK_PLAN.md with multiple runs for averaging.
"""

import subprocess
import time
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Configuration
DGAT_PATH = "/home/pradheep/DGAT/build/dgat"
DGAT_BACKEND_URL = "http://localhost:8090"
OPENCODE_AVAILABLE = True  # Assume opencode is available in environment
NUM_RUNS = 5  # Number of runs for averaging
TEST_FILE = "/home/pradheep/DGAT/dgat.cpp"  # File to test with
TEST_CONCEPT = "dependency graph"  # Concept to search for
TEST_DIR = "/home/pradheep/DGAT"  # Directory to analyze

class BenchmarkRunner:
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "config": {
                "num_runs": NUM_RUNS,
                "test_file": TEST_FILE,
                "test_concept": TEST_CONCEPT,
                "test_dir": TEST_DIR
            },
            "tasks": {}
        }
        
    def run_command(self, cmd, timeout=30):
        """Run a command and return (success, output, elapsed_time)"""
        start_time = time.time()
        try:
            result = subprocess.run(
                cmd, 
                shell=True, 
                capture_output=True, 
                text=True, 
                timeout=timeout
            )
            elapsed = time.time() - start_time
            return (
                result.returncode == 0, 
                result.stdout + result.stderr, 
                elapsed
            )
        except subprocess.TimeoutExpired:
            elapsed = time.time() - start_time
            return (False, f"Command timed out after {timeout}s", elapsed)
        except Exception as e:
            elapsed = time.time() - start_time
            return (False, str(e), elapsed)
    
    def run_dgat_context(self, file_path):
        """Run DGAT context command via API"""
        # Start backend if not running
        self.ensure_backend_running()
        
        cmd = f"curl -s '{DGAT_BACKEND_URL}/api/context?file={file_path}'"
        success, output, elapsed = self.run_command(cmd)
        
        if success:
            try:
                data = json.loads(output)
                if data.get("code") == "FILE_NOT_FOUND":
                    return False, output, elapsed
                return True, json.dumps(data, indent=2), elapsed
            except json.JSONDecodeError:
                return False, output, elapsed
        return False, output, elapsed
    
    def run_opencode_native_context(self, file_path):
        """Simulate Opencode native approach for file purpose identification"""
        # This would involve read + grep + manual analysis
        # We'll simulate with a combination of commands
        commands = [
            f"head -20 {file_path}",
            f"grep -n 'class\\|function\\|def\\|struct' {file_path} | head -10",
            f"wc -l {file_path}",
            f"file {file_path}"
        ]
        
        start_time = time.time()
        outputs = []
        for cmd in commands:
            success, output, _ = self.run_command(cmd)
            if success:
                outputs.append(f"[{cmd}]\\n{output}")
            else:
                outputs.append(f"[{cmd}] FAILED: {output}")
        elapsed = time.time() - start_time
        
        return True, "\\n\\n".join(outputs), elapsed
    
    def ensure_backend_running(self):
        """Ensure DGAT backend is running"""
        # Check if backend is responding
        success, _, _ = self.run_command(f"curl -s {DGAT_BACKEND_URL}/api/health", timeout=2)
        if not success:
            # Start backend in background
            print("Starting DGAT backend...")
            subprocess.Popen(
                [DGAT_PATH, "--backend"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            # Wait for it to start
            time.sleep(3)
            
            # Verify it's running
            for _ in range(10):  # Try for 10 seconds
                success, _, _ = self.run_command(f"curl -s {DGAT_BACKEND_URL}/api/health", timeout=2)
                if success:
                    break
                time.sleep(1)
    
    def benchmark_task_1_1(self):
        """Benchmark Task 1.1: File Purpose Identification"""
        print("Running Benchmark Task 1.1: File Purpose Identification")
        
        dgat_times = []
        opencode_times = []
        dgat_results = []
        opencode_results = []
        
        for i in range(NUM_RUNS):
            print(f"  Run {i+1}/{NUM_RUNS}")
            
            # DGAT approach
            success, output, elapsed = self.run_dgat_context(TEST_FILE)
            dgat_times.append(elapsed)
            dgat_results.append({"success": success, "output": output})
            
            # Opencode native approach
            success, output, elapsed = self.run_opencode_native_context(TEST_FILE)
            opencode_times.append(elapsed)
            opencode_results.append({"success": success, "output": output})
        
        # Calculate averages
        avg_dgat_time = sum(dgat_times) / len(dgat_times)
        avg_opencode_time = sum(opencode_times) / len(opencode_times)
        
        self.results["tasks"]["1.1_file_purpose_identification"] = {
            "description": "Determine what a specific file does",
            "dgat_approach": "dgat_context <file>",
            "opencode_approach": "Combination of read, grep for function/class definitions, manual analysis",
            "metrics": {
                "dgat": {
                    "avg_time_seconds": avg_dgat_time,
                    "raw_times": dgat_times,
                    "success_rate": sum(1 for r in dgat_results if r["success"]) / len(dgat_results),
                    "sample_output": dgat_results[0]["output"][:500] if dgat_results[0]["success"] else dgat_results[0]["output"]
                },
                "opencode": {
                    "avg_time_seconds": avg_opencode_time,
                    "raw_times": opencode_times,
                    "success_rate": sum(1 for r in opencode_results if r["success"]) / len(opencode_results),
                    "sample_output": opencode_results[0]["output"][:500] if opencode_results[0]["success"] else opencode_results[0]["output"]
                }
            },
            "speedup": avg_opencode_time / avg_dgat_time if avg_dgat_time > 0 else 0
        }
    
    def benchmark_task_1_2(self):
        """Benchmark Task 1.2: Project Architecture Overview"""
        print("Running Benchmark Task 1.2: Project Architecture Overview")
        
        dgat_times = []
        opencode_times = []
        dgat_results = []
        opencode_results = []
        
        for i in range(NUM_RUNS):
            print(f"  Run {i+1}/{NUM_RUNS}")
            
            # DGAT approach
            success, output, elapsed = self.run_command(f"curl -s '{DGAT_BACKEND_URL}/api/blueprint'")
            dgat_times.append(elapsed)
            dgat_results.append({"success": success, "output": output})
            
            # Opencode native approach - simulate with directory traversal
            start_time = time.time()
            # Get file count, list key files, read README, etc.
            commands = [
                f"find {TEST_DIR} -type f -name '*.md' | head -5",
                f"find {TEST_DIR} -type f -name '*.cpp' -o -name '*.h' | head -10",
                f"ls -la {TEST_DIR}/",
                f"head -30 {TEST_DIR}/README.md" if os.path.exists(f"{TEST_DIR}/README.md") else "echo 'No README found'"
            ]
            outputs = []
            for cmd in commands:
                success, output, _ = self.run_command(cmd)
                if success:
                    outputs.append(f"[{cmd}]\\n{output}")
                else:
                    outputs.append(f"[{cmd}] FAILED: {output}")
            elapsed = time.time() - start_time
            
            opencode_times.append(elapsed)
            opencode_results.append({"success": True, "output": "\\n\\n".join(outputs)})
        
        # Calculate averages
        avg_dgat_time = sum(dgat_times) / len(dgat_times)
        avg_opencode_time = sum(opencode_times) / len(opencode_times)
        
        self.results["tasks"]["1.2_project_architecture_overview"] = {
            "description": "Get a high-level understanding of project structure",
            "dgat_approach": "dgat_blueprint",
            "opencode_approach": "Directory traversal with glob, reading key files like README, manual synthesis",
            "metrics": {
                "dgat": {
                    "avg_time_seconds": avg_dgat_time,
                    "raw_times": dgat_times,
                    "success_rate": sum(1 for r in dgat_results if r["success"]) / len(dgat_results),
                    "sample_output": dgat_results[0]["output"][:500] if dgat_results[0]["success"] else dgat_results[0]["output"]
                },
                "opencode": {
                    "avg_time_seconds": avg_opencode_time,
                    "raw_times": opencode_times,
                    "success_rate": sum(1 for r in opencode_results if r["success"]) / len(opencode_results),
                    "sample_output": opencode_results[0]["output"][:500] if opencode_results[0]["success"] else opencode_results[0]["output"]
                }
            },
            "speedup": avg_opencode_time / avg_dgat_time if avg_dgat_time > 0 else 0
        }
    
    def benchmark_task_2_1(self):
        """Benchmark Task 2.1: Concept-Based File Search"""
        print("Running Benchmark Task 2.1: Concept-Based File Search")
        
        dgat_times = []
        opencode_times = []
        dgat_results = []
        opencode_results = []
        
        for i in range(NUM_RUNS):
            print(f"  Run {i+1}/{NUM_RUNS}")
            
            # DGAT approach
            success, output, elapsed = self.run_command(f"curl -s '{DGAT_BACKEND_URL}/api/search?q={TEST_CONCEPT}'")
            dgat_times.append(elapsed)
            dgat_results.append({"success": success, "output": output})
            
            # Opencode native approach
            start_time = time.time()
            success, output, _ = self.run_command(f"grep -r -i '{TEST_CONCEPT}' {TEST_DIR} --include='*.cpp' --include='*.h' --include='*.md' --include='*.ts' --include='*.tsx' | head -20")
            elapsed = time.time() - start_time
            
            opencode_times.append(elapsed)
            opencode_results.append({"success": success, "output": output})
        
        # Calculate averages
        avg_dgat_time = sum(dgat_times) / len(dgat_times)
        avg_opencode_time = sum(opencode_times) / len(opencode_times)
        
        self.results["tasks"]["2.1_concept_based_file_search"] = {
            "description": f"Find all files related to a specific concept ('{TEST_CONCEPT}')",
            "dgat_approach": f'dgat_search "{TEST_CONCEPT}"',
            "opencode_approach": "grep -r for keywords, filename pattern matching",
            "metrics": {
                "dgat": {
                    "avg_time_seconds": avg_dgat_time,
                    "raw_times": dgat_times,
                    "success_rate": sum(1 for r in dgat_results if r["success"]) / len(dgat_results),
                    "sample_output": dgat_results[0]["output"][:500] if dgat_results[0]["success"] else dgat_results[0]["output"]
                },
                "opencode": {
                    "avg_time_seconds": avg_opencode_time,
                    "raw_times": opencode_times,
                    "success_rate": sum(1 for r in opencode_results if r["success"]) / len(opencode_results),
                    "sample_output": opencode_results[0]["output"][:500] if opencode_results[0]["success"] else opencode_results[0]["output"]
                }
            },
            "speedup": avg_opencode_time / avg_dgat_time if avg_dgat_time > 0 else 0
        }
    
    def run_all_benchmarks(self):
        """Run all benchmark tasks"""
        print("Starting DGAT vs Opencode Native Tools Benchmark")
        print(f"Configuration: {NUM_RUNS} runs per task")
        print(f"Test file: {TEST_FILE}")
        print(f"Test concept: {TEST_CONCEPT}")
        print(f"Test directory: {TEST_DIR}")
        print("-" * 60)
        
        # Ensure we have a dependency graph
        if not os.path.exists("/home/pradheep/DGAT/dep_graph.json"):
            print("Building dependency graph...")
            subprocess.run([DGAT_PATH, "--deps-only"], 
                         stdout=subprocess.DEVNULL, 
                         stderr=subprocess.DEVNULL)
        
        # Run benchmark tasks
        try:
            self.benchmark_task_1_1()
        except Exception as e:
            print(f"Error in task 1.1: {e}")
            
        try:
            self.benchmark_task_1_2()
        except Exception as e:
            print(f"Error in task 1.2: {e}")
            
        try:
            self.benchmark_task_2_1()
        except Exception as e:
            print(f"Error in task 2.1: {e}")
        
        # Add summary
        self.results["summary"] = self.generate_summary()
        
        return self.results
    
    def generate_summary(self):
        """Generate summary statistics"""
        tasks = self.results.get("tasks", {})
        if not tasks:
            return {"message": "No tasks completed"}
        
        speedups = []
        dgat_wins = 0
        total_tasks = len(tasks)
        
        for task_name, task_data in tasks.items():
            speedup = task_data.get("speedup", 0)
            if speedup > 0:
                speedups.append(speedup)
                if speedup > 1:  # DGAT is faster
                    dgat_wins += 1
        
        avg_speedup = sum(speedups) / len(speedups) if speedups else 0
        
        return {
            "total_tasks": total_tasks,
            "dgat_wins": dgat_wins,
            "dgat_win_rate": dgat_wins / total_tasks if total_tasks > 0 else 0,
            "average_speedup": avg_speedup,
            "fastest_speedup": max(speedups) if speedups else 0,
            "slowest_speedup": min(speedups) if speedups else 0
        }
    
    def save_results(self, filename=None):
        """Save results to JSON file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"/home/pradheep/DGAT/benchmark/results/benchmark_results_{timestamp}.json"
        
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"Results saved to: {filename}")
        return filename

def main():
    runner = BenchmarkRunner()
    results = runner.run_all_benchmarks()
    runner.save_results()
    
    # Print summary
    summary = results.get("summary", {})
    print("\n" + "="*60)
    print("BENCHMARK SUMMARY")
    print("="*60)
    print(f"Total tasks: {summary.get('total_tasks', 0)}")
    print(f"DGAT wins: {summary.get('dgat_wins', 0)} ({summary.get('dgat_win_rate', 0):.1%})")
    print(f"Average speedup: {summary.get('average_speedup', 0):.2f}x")
    if summary.get('average_speedup', 0) > 1:
        print("✅ DGAT is faster on average")
    else:
        print("❌ Opencode native tools are faster on average")

if __name__ == "__main__":
    main()
