SOURCE_DIR="src/"
TARGET_DIR="examples/react/src/lib/notifly/"

echo "Copying SDK from $SOURCE_DIR to $TARGET_DIR"

mkdir -p "$TARGET_DIR"
rsync -av --exclude='NotiflyServiceWorker.ts' "$SOURCE_DIR" "$TARGET_DIR"

echo "Done copying SDK"
