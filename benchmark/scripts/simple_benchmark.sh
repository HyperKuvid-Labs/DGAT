#!/bin/bash
# Simple benchmark script for DGAT vs Opencode native tools
# Based on BENCHMARK_PLAN.md

set -e

# Configuration
DGAT_PATH="/home/pradheep/DGAT/build/dgat"
DGAT_BACKEND_URL="http://localhost:8090"
NUM_RUNS=5
TEST_FILE="/home/pradheep/DGAT/dgat.cpp"
TEST_CONCEPT="dependency graph"
TEST_DIR="/home/pradheep/DGAT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting DGAT vs Opencode Native Tools Benchmark${NC}"
echo -e "Configuration: ${NUM_RUNS} runs per task"
echo -e "Test file: ${TEST_FILE}"
echo -e "Test concept: ${TEST_CONCEPT}"
echo -e "Test directory: ${TEST_DIR}"
echo -e "${YELLOW}------------------------------------------------${NC}"

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
        dgat_times+=($dgat_elapsed)
        
        # Run Opencode approach
        start_time=$(date +%s.%N)
        eval "$opencode_cmd" >/dev/null 2>&1
        opencode_end_time=$(date +%s.%N)
        opencode_elapsed=$(echo "$opencode_end_time - $start_time" | bc)
        opencode_times+=($opencode_elapsed)
        
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
    
    local dgat_avg=$(echo "$dgat_sum / $NUM_RUNS" | bc -l)
    local opencode_avg=$(echo "$opencode_sum / $NUM_RUNS" | bc -l)
    
    # Calculate speedup (Opencode time / DGAT time)
    # If DGAT is faster, speedup > 1
    local speedup="0"
    if (( $(echo "$dgat_avg > 0" | bc -l) )); then
        speedup=$(echo "$opencode_avg / $dgat_avg" | bc -l)
    fi
    
    echo -e "  ${GREEN}Average - DGAT: ${dgat_avg}s, Opencode: ${opencode_avg}s, Speedup: ${speedup}x${NC}"
    echo ""
    
    # Return results as JSON-like string for easy parsing
    echo "{\"name\":\"$name\",\"dgat_avg\":$dgat_avg,\"opencode_avg\":$opencode_avg,\"speedup\":$speedup}"
}

# Main benchmark execution
main() {
    start_backend
    
    # Task 1.1: File Purpose Identification
    RESULT_1_1=$(run_benchmark \
        "File Purpose Identification" \
        "curl -s '$DGAT_BACKEND_URL/api/context?file=$TEST_FILE' >/dev/null" \
        "head -20 $TEST_FILE && grep -n 'class\\|function\\|def\\|struct' $TEST_FILE | head -10"
    )
    
    # Task 1.2: Project Architecture Overview
    RESULT_1_2=$(run_benchmark \
        "Project Architecture Overview" \
        "curl -s '$DGAT_BACKEND_URL/api/blueprint' >/dev/null" \
        "find $TEST_DIR -type f -name '*.md' | head -5 && find $TEST_DIR -type f -name '*.cpp' -o -name '*.h' | head -10 && ls -la $TEST_DIR/"
    )
    
    # Task 2.1: Concept-Based File Search
    RESULT_2_1=$(run_benchmark \
        "Concept-Based File Search" \
        "curl -s '$DGAT_BACKEND_URL/api/search?q=$TEST_CONCEPT' >/dev/null" \
        "grep -r -i '$TEST_CONCEPT' $TEST_DIR --include='*.cpp' --include='*.h' --include='*.md' --include='*.ts' --include='*.tsx' | head -20"
    )
    
    # Summary
    echo -e "${YELLOW}================================================${NC}"
    echo -e "${YELLOW}BENCHMARK SUMMARY${NC}"
    echo -e "${YELLOW}================================================${NC}"
    
    # Extract values from results (simple parsing)
    local dgat_1_1=$(echo "$RESULT_1_1" | grep -o '"dgat_avg":[0-9.]*' | cut -d':' -f2)
    local opencode_1_1=$(echo "$RESULT_1_1" | grep -o '"opencode_avg":[0-9.]*' | cut -d':' -f2)
    local speedup_1_1=$(echo "$RESULT_1_1" | grep -o '"speedup":[0-9.]*' | cut -d':' -f2)
    
    local dgat_1_2=$(echo "$RESULT_1_2" | grep -o '"dgat_avg":[0-9.]*' | cut -d':' -f2)
    local opencode_1_2=$(echo "$RESULT_1_2" | grep -o '"opencode_avg":[0-9.]*' | cut -d':' -f2)
    local speedup_1_2=$(echo "$RESULT_1_2" | grep -o '"speedup":[0-9.]*' | cut -d':' -f2)
    
    local dgat_2_1=$(echo "$RESULT_2_1" | grep -o '"dgat_avg":[0-9.]*' | cut -d':' -f2)
    local opencode_2_1=$(echo "$RESULT_2_1" | grep -o '"opencode_avg":[0-9.]*' | cut -d':' -f2)
    local speedup_2_1=$(echo "$RESULT_2_1" | grep -o '"speedup":[0-9.]*' | cut -d':' -f2)
    
    echo -e "Task 1.1 - File Purpose Identification:"
    echo -e "  DGAT: ${dgat_1_1}s, Opencode: ${opencode_1_1}s, Speedup: ${speedup_1_1}x"
    
    echo -e "Task 1.2 - Project Architecture Overview:"
    echo -e "  DGAT: ${dgat_1_2}s, Opencode: ${opencode_1_2}s, Speedup: ${speedup_1_2}x"
    
    echo -e "Task 2.1 - Concept-Based File Search:"
    echo -e "  DGAT: ${dgat_2_1}s, Opencode: ${opencode_2_1}s, Speedup: ${speedup_2_1}x"
    
    # Calculate overall average speedup
    local avg_speedup=$(echo "($speedup_1_1 + $speedup_1_2 + $speedup_2_1) / 3" | bc -l)
    echo -e "${GREEN}Average Speedup Across All Tasks: ${avg_speedup}x${NC}"
    
    if (( $(echo "$avg_speedup > 1" | bc -l) )); then
        echo -e "${GREEN}✅ DGAT is faster on average${NC}"
    else
        echo -e "${RED}❌ Opencode native tools are faster on average${NC}"
    fi
    
    # Cleanup
    kill $BACKEND_PID 2>/dev/null || true
}

# Execute main function
main