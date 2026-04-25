cmake_minimum_required(VERSION 3.16)
project(DGAT VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(ENABLE_TREE_SITTER "Enable tree-sitter support" ON)
option(ENABLE_GUI "Enable GUI server" ON)

if(NOT DEFINED GRAMMARS_DIR)
    set(GRAMMARS_DIR "${CMAKE_SOURCE_DIR}/grammars")
endif()

find_package(OpenSSL REQUIRED)

if(EXISTS "/usr/lib/x86_64-linux-gnu/libxxhash.so.0")
    set(XXHASH_LIBRARY "/usr/lib/x86_64-linux-gnu/libxxhash.so.0")
    message(STATUS "Found xxhash: ${XXHASH_LIBRARY}")
elseif(EXISTS "/lib/x86_64-linux-gnu/libxxhash.so.0")
    set(XXHASH_LIBRARY "/lib/x86_64-linux-gnu/libxxhash.so.0")
    message(STATUS "Found xxhash: ${XXHASH_LIBRARY}")
else()
    find_library(XXHASH_LIBRARY NAMES xxhash)
    if(XXHASH_LIBRARY)
        message(STATUS "Found xxhash: ${XXHASH_LIBRARY}")
    else()
        message(WARNING "xxhash library not found, using header-only mode (XXH_INLINE_ALL)")
        set(XXHASH_LIBRARY "")
        add_definitions(-DXXH_INLINE_ALL)
    endif()
endif()

include_directories(
    ${CMAKE_SOURCE_DIR}
    ${OPENSSL_INCLUDE_DIR}
)

set(DGAT_SOURCES
    dgat.cpp
)

set(DGAT_HEADERS
    httplib.h
    xxhash.h
    inja.hpp
    json.hpp
)

add_executable(dgat ${DGAT_SOURCES} ${DGAT_HEADERS})

# Fix for Windows: "number of sections exceeded object file format limit"
if(MSVC)
    target_compile_options(dgat PRIVATE /bigobj)
endif()

target_link_libraries(dgat
    PRIVATE
    OpenSSL::SSL
    OpenSSL::Crypto
)

if(APPLE)
    find_library(COREFOUNDATION_FRAMEWORK CoreFoundation REQUIRED)
    find_library(SECURITY_FRAMEWORK Security REQUIRED)
    target_link_libraries(dgat PRIVATE ${COREFOUNDATION_FRAMEWORK} ${SECURITY_FRAMEWORK})
endif()

if(XXHASH_LIBRARY)
    target_link_libraries(dgat PRIVATE ${XXHASH_LIBRARY})
endif()

if(NOT WIN32)
    target_link_libraries(dgat PRIVATE pthread dl)
endif()

if(ENABLE_TREE_SITTER)
    find_program(TREE_SITTER_EXE tree-sitter)
    if(TREE_SITTER_EXE)
        message(STATUS "tree-sitter found: ${TREE_SITTER_EXE}")
        
        file(GLOB QUERY_FILES "${CMAKE_SOURCE_DIR}/queries/*.scm")
        if(QUERY_FILES)
            message(STATUS "Found ${CMAKE_CURRENT_SOURCE_DIR}/queries/*.scm")
            foreach(QFILE ${QUERY_FILES})
                message(STATUS "  - ${QFILE}")
            endforeach()
        endif()
    else()
        message(WARNING "tree-sitter not found. Install it for import extraction: ./install.sh cli grammars configure")
    endif()
endif()

install(TARGETS dgat
    RUNTIME DESTINATION bin
)

# Auto-copy built binary into the Python package so `pip install -e .` picks it up.
add_custom_command(TARGET dgat POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/src/dgat/bin
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:dgat> ${CMAKE_SOURCE_DIR}/src/dgat/bin/dgat
    COMMENT "Copying dgat binary → src/dgat/bin/dgat"
)

install(DIRECTORY queries/
    DESTINATION share/dgat/queries
    FILES_MATCHING PATTERN "*.scm"
)

install(DIRECTORY ${GRAMMARS_DIR}/
    DESTINATION share/dgat/grammars
    PATTERN ".git" EXCLUDE
    PATTERN "node_modules/.cache" EXCLUDE
)

configure_file(
    "${CMAKE_SOURCE_DIR}/tree-sitter-config.json.in"
    "${CMAKE_BINARY_DIR}/tree-sitter-config.json"
    @ONLY
)

install(FILES "${CMAKE_BINARY_DIR}/tree-sitter-config.json"
    DESTINATION share/dgat
    RENAME tree-sitter-config.json
)

if(ENABLE_GUI)
    message(STATUS "GUI server enabled (requires httplib)")
endif()

set(CPACK_GENERATOR "DEB;RPM;TGZ")
set(CPACK_PACKAGE_NAME "dgat")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_CONTACT "DGAT Project")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Dependency Graph Analysis Tool")

include(CPack)
