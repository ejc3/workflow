#!/bin/bash
set -e

# Script to recursively resolve all symlinks in the app directory
# This is needed for Vercel builds where symlinks outside project root don't work

echo "Resolving all symlinks in current directory..."

# Find all symlinks in current directory (including nested ones), excluding gitignored files
git ls-files -z --cached --others --exclude-standard | xargs -0 -I {} sh -c 'test -L "{}" && echo "{}"' | while read -r symlink; do
  # Get the target of the symlink
  target=$(readlink "$symlink")

  # Check if target is absolute or relative
  if [[ "$target" = /* ]]; then
    resolved_target="$target"
  else
    # Resolve relative symlink path
    symlink_dir=$(dirname "$symlink")
    resolved_target="$symlink_dir/$target"
  fi

  echo "Resolving: $symlink -> $resolved_target"

  # Remove the symlink
  rm "$symlink"

  # Copy the target to the symlink location
  if [ -d "$resolved_target" ]; then
    cp -r "$resolved_target" "$symlink"
  else
    cp "$resolved_target" "$symlink"
  fi
done

echo "All symlinks resolved successfully!"
