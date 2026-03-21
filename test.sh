set -e

CPP_FILE="dgat.cpp"
BIN_FILE="tmp/dgat_test_bin"

mkdir -p tmp
g++ -o g++17 "$BIN_FILE" "$CPP_FILE"

printf "\n========== OUTPUT (%s) ==========\n" "$CPP_FILE"
"$BIN_FILE"
printf "\n========== DONE ==========\n"

