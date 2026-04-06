#!/bin/bash
# Robust benchmark script for DGAT vs Opencode native tools
# Based on BENCHMARK_PLAN.md with multiple runs for averaging

set -e

# Configuration
DGAT_PATH="/home/pradheep/DGAT/build/dgat"
DGAT_BACKEND_URL="http://localhost:8090"
NUM_RUNS=20  # Number of runs for averaging
TEST_FILE="/home/pradheep/DGAT/dgat.cpp"
TEST_CONCEPT="dependency graph"
TEST_DIR="/home/pradheep/DGAT"
RESULTS_DIR="/home/pradheep/DGAT/benchmark/results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}Starting DGAT vs Opencode Native Tools Benchmark${NC}"
echo -e "Configuration: ${NUM_RUNS} runs per task"
echo -e "Test file: ${TEST_FILE}"
echo -e "Test concept: ${TEST_CONCEPT}"
echo -e "Test directory: ${TEST_DIR}"
echo -e "${BLUE}------------------------------------------------${NC}"

# Ensure dependency graph exists
if [ ! -f "/home/pradheep/DGAT/dep_graph.json" ] || [ ! -f "/home/pradheep/DGAT/file_tree.json" ]; then
    echo -e "${YELLOW}Building dependency graph...${NC}"
    "$DGAT_PATH" --deps-only >/dev/null 2>&1
else
    echo -e "${GREEN}Dependency graph already exists${NC}"
fi

# Start DGAT backend if not running
start_backend() {
    # Check if backend is responding
    if ! curl -s "$DGAT_BACKEND_URL/api/health" >/dev/null 2>&1; then
        echo -e "${YELLOW}Starting DGAT backend...${NC}"
        cd /home/pradheep/DGAT && "$DGAT_PATH" --backend &
        BACKEND_PID=$!
        # Wait for backend to start
        sleep 3
        # Verify it's running
        for i in {1..10}; do
            if curl -s "$DGAT_BACKEND_URL/api/health" >/dev/null 2>&1; then
                echo -e "${GREEN}Backend started successfully${NC}"
                return 0
            fi
            sleep 1
        done
        echo -e "${RED}Failed to start backend${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        return 1
    fi
}

# Run a command multiple times and return average time
run_benchmark() {
    local name="$1"
    local dgat_cmd="$2"
    local opencode_cmd="$3"
    
    echo -e "${YELLOW}Running: $name${NC}"
    
    local dgat_times=()
    local opencode_times=()
    
    for i in $(seq 1 $NUM_RUNS); do
        echo -n "  Run $i/$NUM_RUNS: "
        
        # Run DGAT approach
        start_time=$(date +%s.%N)
        eval "$dgat_cmd" >/dev/null 2>&1
        dgat_end_time=$(date +%s.%N)
        dgat_elapsed=$(echo "$dgat_end_time - $start_time" | bc)
        dgat_times+=("$dgat_elapsed")
        
        # Run Opencode approach
        start_time=$(date +%s.%N)
        eval "$opencode_cmd" >/dev/null 2>&1
        opencode_end_time=$(date +%s.%N)
        opencode_elapsed=$(echo "$opencode_end_time - $start_time" | bc)
        opencode_times+=("$opencode_elapsed")
        
        printf "DGAT: %.4fs, Opencode: %.4fs\n" "$dgat_elapsed" "$opencode_elapsed"
    done
    
    # Calculate averages
    local dgat_sum=0
    local opencode_sum=0
    for time in "${dgat_times[@]}"; do
        dgat_sum=$(echo "$dgat_sum + $time" | bc)
    done
    for time in "${opencode_times[@]}"; do
        opencode_sum=$(echo "$opencode_sum + $time" | bc)
    done
    
    local dgat_avg=$(echo "scale=6; $dgat_sum / $NUM_RUNS" | bc)
    local opencode_avg=$(echo "scale=6; $opencode_sum / $NUM_RUNS" | bc)
    
    # Calculate speedup (Opencode time / DGAT time)
    # If DGAT is faster, speedup > 1
    local speedup="0"
    if (( $(echo "$dgat_avg > 0" | bc -l) )); then
        speedup=$(echo "scale=6; $opencode_avg / $dgat_avg" | bc)
    fi
    
    echo -e "  ${GREEN}Average - DGAT: ${dgat_avg}s, Opencode: ${opencode_avg}s, Speedup: ${speedup}x${NC}"
    echo ""
    
    # Return results as JSON for easy parsing
    # Format times arrays properly for JSON
    local dgat_times_json=$(IFS=,; echo "[${dgat_times[*]}]")
    local opencode_times_json=$(IFS=,; echo "[${opencode_times[*]}]")
    echo "{\"name\":\"$name\",\"dgat_avg\":$dgat_avg,\"opencode_avg\":$opencode_avg,\"speedup\":$speedup,\"dgat_times\":$dgat_times_json,\"opencode_times\":$opencode_times_json}"
}

# Main benchmark execution
main() {
    start_backend
    
    # Array to store results
    RESULTS=()
    
    # Task 1.1: File Purpose Identification
    RESULT=$(run_benchmark \
        "File Purpose Identification" \
        "curl -s '$DGAT_BACKEND_URL/api/context?file=$TEST_FILE' >/dev/null" \
        "head -20 $TEST_FILE && grep -n 'class\\|function\\|def\\|struct' $TEST_FILE | head -10"
    )
    RESULTS+=("$RESULT")
    
    # Task 1.2: Project Architecture Overview
    RESULT=$(run_benchmark \
        "Project Architecture Overview" \
        "curl -s '$DGAT_BACKEND_URL/api/blueprint' >/dev/null" \
        "find $TEST_DIR -type f -name '*.md' | head -5 && find $TEST_DIR -type f -name '*.cpp' -o -name '*.h' | head -10 && ls -la $TEST_DIR/"
    )
    RESULTS+=("$RESULT")
    
    # Task 2.1: Concept-Based File Search
    RESULT=$(run_benchmark \
        "Concept-Based File Search" \
        "curl -s '$DGAT_BACKEND_URL/api/search?q=$TEST_CONCEPT' >/dev/null" \
        "grep -r -i '$TEST_CONCEPT' $TEST_DIR --include='*.cpp' --include='*.h' --include='*.md' --include='*.ts' --include='*.tsx' | head -20"
    )
    RESULTS+=("$RESULT")
    
    # Task 2.2: Dependency Tracing (What a file imports/depends on)
    RESULT=$(run_benchmark \
        "Dependency Tracing" \
        "curl -s '$DGAT_BACKEND_URL/api/dependencies?file=$TEST_FILE' >/dev/null" \
        "grep -n '^.*#include.*\"' $TEST_FILE | head -10"
    )
    RESULTS+=("$RESULT")
    
    # Task 2.3: Reverse Dependency Analysis (What files depend on a specific file)
    RESULT=$(run_benchmark \
        "Reverse Dependency Analysis" \
        "curl -s '$DGAT_BACKEND_URL/api/dependents?file=$TEST_FILE' >/dev/null" \
        "grep -r '#include.*dgat.cpp' $TEST_DIR | head -10"
    )
    RESULTS+=("$RESULT")
    
    # Task 3.1: Blast Radius Analysis
    RESULT=$(run_benchmark \
        "Blast Radius Analysis" \
        "curl -s '$DGAT_BACKEND_URL/api/impact?file=$TEST_FILE' >/dev/null" \
        "echo 'Manual analysis required for native approach'"
    )
    RESULTS+=("$RESULT")
    
    # Task 3.3: Entry Point Identification
    RESULT=$(run_benchmark \
        "Entry Point Identification" \
        "curl -s '$DGAT_BACKEND_URL/api/entry-points' >/dev/null" \
        "grep -l 'int main' $TEST_DIR/*.cpp $TEST_DIR/*.c 2>/dev/null | head -5"
    )
    RESULTS+=("$RESULT")
    
    # Summary
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}BENCHMARK SUMMARY${NC}"
    echo -e "${BLUE}================================================${NC}"
    
    local total_speedup=0
    local count=0
    local dgat_wins=0
    
    for RESULT in "${RESULTS[@]}"; do
        local name=$(echo "$RESULT" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        local dgat_avg=$(echo "$RESULT" | grep -o '"dgat_avg":[0-9.]*' | cut -d':' -f2)
        local opencode_avg=$(echo "$RESULT" | grep -o '"opencode_avg":[0-9.]*' | cut -d':' -f2)
        local speedup=$(echo "$RESULT" | grep -o '"speedup":[0-9.]*' | cut -d':' -f2)
        
        echo -e "$name:"
        echo -e "  DGAT: ${dgat_avg}s, Opencode: ${opencode_avg}s, Speedup: ${speedup}x"
        
        # Only count valid speedups (greater than 0)
        if (( $(echo "$speedup > 0" | bc -l) )); then
            total_speedup=$(echo "$total_speedup + $speedup" | bc -l)
            count=$((count + 1))
            if (( $(echo "$speedup > 1" | bc -l) )); then
                dgat_wins=$((dgat_wins + 1))
            fi
        fi
        echo ""
    done
    
    # Calculate overall averages
    if [ $count -gt 0 ]; then
        local avg_speedup=$(echo "scale=6; $total_speedup / $count" | bc)
        local win_rate=$(echo "scale=2; $dgat_wins / $count * 100" | bc)
        
        echo -e "${GREEN}Average Speedup Across All Tasks: ${avg_speedup}x${NC}"
        echo -e "${GREEN}DGAT Win Rate: ${win_rate}% (${dgat_wins}/$count tasks)${NC}"
        
        if (( $(echo "$avg_speedup > 1" | bc -l) )); then
            echo -e "${GREEN}✅ DGAT is faster on average${NC}"
        else
            echo -e "${RED}❌ Opencode native tools are faster on average${NC}"
        fi
    else
        echo -e "${RED}No valid speedup calculations could be made${NC}"
    fi
    
    # Save detailed results
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    RESULTS_FILE="$RESULTS_DIR/benchmark_results_${TIMESTAMP}.json"
    
    # Build JSON array manually to avoid issues with array expansion
    local json_array=""
    for i in "${!RESULTS[@]}"; do
        if [ $i -gt 0 ]; then
            json_array="$json_array,"
        fi
        json_array="$json_array${RESULTS[$i]}"
    done
    
    echo "{
  \"timestamp\": \"$(date -Iseconds)\",
  \"config\": {
    \"num_runs\": $NUM_RUNS,
    \"test_file\": \"$TEST_FILE\",
    \"test_concept\": \"$TEST_CONCEPT\",
    \"test_dir\": \"$TEST_DIR\"
  },
  \"results\": [$json_array]
}" > "$RESULTS_FILE"
    
    echo -e "${BLUE}Detailed results saved to: $RESULTS_FILE${NC}"
    
    # Cleanup
    kill $BACKEND_PID 2>/dev/null || true
}

# Execute main function
main