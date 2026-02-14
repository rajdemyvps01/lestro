echo "⏳ Saving changes to GitHub..."
git add .
git commit -m "💾 Auto-saved changes from Web Panel [skip ci]" || echo "No changes to save."
git push origin HEAD || echo "⚠️ Push failed! Check PAT_TOKEN."
echo "✅ Save Process Completed!"
