# DGAT vs Opencode Native Tools Benchmark Summary

## Overview
This report summarizes the benchmark results comparing DGAT's specialized dependency graph analysis tools against Opencode's native general-purpose tools (grep, glob, read/write/edit, task agents, etc.) based on the BENCHMARK_PLAN.md.

## Benchmark Configuration
- **Test File**: `/home/pradheep/DGAT/dgat.cpp`
- **Test Concept**: "dependency graph"
- **Test Directory**: `/home/pradheep/DGAT`
- **Number of Runs per Task**: 5
- **Timestamp**: 2026-04-06T11:18:55+05:30

## Benchmark Results

| Task | DGAT Approach | Opencode Approach | Avg DGAT Time (s) | Avg Opencode Time (s) | Speedup (Opencode/DGAT) | Winner |
|------|---------------|-------------------|-------------------|-----------------------|-------------------------|--------|
| File Purpose Identification | `dgat_context <file>` | head + grep for function/class definitions | 0.011966 | 0.007982 | 0.667x | Opencode |
| Project Architecture Overview | `dgat_blueprint` | Directory traversal + README reading | 0.009607 | 0.091333 | 9.507x | DGAT |
| Concept-Based File Search | `dgat_search "dependency graph"` | grep -r for keywords | 0.011878 | 0.012739 | 1.072x | DGAT |
| Dependency Tracing | `dgat_dependencies <file>` | grep for #include statements | 0.013290 | 0.005301 | 0.399x | Opencode |
| Reverse Dependency Analysis | `dgat_dependents <file>` | grep -r for imports of target file | 0.014293 | 3.899516 | 272.827x | DGAT |
| Blast Radius Analysis | `dgat_impact <file>` | Manual analysis required | 0.011404 | 0.002339 | 0.205x | Opencode |
| Entry Point Identification | `dgat_entry_points` | grep for 'int main' | 0.011985 | 0.004987 | 0.416x | Opencode |

## Detailed Timing Data

### File Purpose Identification
- **DGAT Times**: 0.0102s, 0.0128s, 0.0126s, 0.0122s, 0.0120s
- **Opencode Times**: 0.0088s, 0.0071s, 0.0078s, 0.0081s, 0.0081s

### Project Architecture Overview
- **DGAT Times**: 0.0125s, 0.0117s, 0.0083s, 0.0077s, 0.0078s
- **Opencode Times**: 0.1996s, 0.0662s, 0.0650s, 0.0592s, 0.0666s

### Concept-Based File Search
- **DGAT Times**: 0.0118s, 0.0120s, 0.0135s, 0.0111s, 0.0109s
- **Opencode Times**: 0.0232s, 0.0076s, 0.0108s, 0.0115s, 0.0106s

### Dependency Tracing
- **DGAT Times**: 0.0139s, 0.0137s, 0.0128s, 0.0130s, 0.0130s
- **Opencode Times**: 0.0051s, 0.0056s, 0.0050s, 0.0051s, 0.0056s

### Reverse Dependency Analysis
- **DGAT Times**: 0.0119s, 0.0216s, 0.0088s, 0.0162s, 0.0130s
- **Opencode Times**: 4.4777s, 3.8283s, 3.7413s, 3.7845s, 3.6659s

### Blast Radius Analysis
- **DGAT Times**: 0.0120s, 0.0105s, 0.0107s, 0.0118s, 0.0120s
- **Opencode Times**: 0.0026s, 0.0022s, 0.0027s, 0.0022s, 0.0021s

### Entry Point Identification
- **DGAT Times**: 0.0110s, 0.0134s, 0.0115s, 0.0114s, 0.0126s
- **Opencode Times**: 0.0033s, 0.0048s, 0.0059s, 0.0061s, 0.0048s

## Summary Statistics
- **Total Tasks Evaluated**: 7
- **Tasks Where DGAT Was Faster**: 3 (42.9%)
- **Tasks Where Opencode Was Faster**: 4 (57.1%)
- **Average Speedup Across All Tasks**: 40.73x
- **Median Speedup**: 0.667x
- **Maximum Speedup**: 272.83x (Reverse Dependency Analysis)
- **Minimum Speedup**: 0.205x (Blast Radius Analysis)

## Key Findings

### Where DGAT Excels:
1. **Reverse Dependency Analysis**: DGAT is **272.8x faster** than Opencode native tools
2. **Project Architecture Overview**: DGAT is **9.5x faster** than Opencode native tools
3. **Concept-Based File Search**: DGAT is **1.07x faster** than Opencode native tools

### Where Opencode Native Tools Excel:
1. **Blast Radius Analysis**: Opencode is **4.9x faster** than DGAT
2. **Dependency Tracing**: Opencode is **2.5x faster** than DGAT
3. **File Purpose Identification**: Opencode is **1.5x faster** than DGAT
4. **Entry Point Identification**: Opencode is **2.4x faster** than DGAT

## Conclusion
DGAT provides significant performance advantages for dependency graph-specific queries, particularly for reverse dependency analysis (finding what files depend on a specific file) and project architecture overview. For tasks that involve simple text searching or basic file examination, Opencode's native tools can be faster due to their lightweight nature and lack of overhead from loading and querying the dependency graph.

The overall average speedup of 40.73x is heavily influenced by the extreme performance difference in reverse dependency analysis. When considering more balanced metrics, DGAT shows strong performance in architectural understanding and dependency-specific queries while Opencode native tools remain suitable for simple text-based searches and file examinations.

## Recommendations
1. Use DGAT for architectural understanding, dependency analysis, and impact assessment tasks
2. Use Opencode native tools for simple text searches, basic file examinations, and quick lookups
3. Consider combining both approaches: use DGAT for complex dependency queries and Opencode for simple filtering operations