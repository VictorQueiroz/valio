#!/bin/bash

VALIO_ARGS=(
  'tsx'
  'cli'
  "$@"
)

EXTENSIONS=(
  '*.ts'
)

FIND_ARGS=()

for ext in "${EXTENSIONS[@]}"; do
  FIND_ARGS+=("-name" "${ext}")

  # If not the last item, add '-or 'here'
  
done

find "${FIND_ARGS[@]}"

npx "${VALIO_ARGS[@]}"
