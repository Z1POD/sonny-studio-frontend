import os

def list_files(startpath):
    # Folders to ignore for a cleaner React structure
    exclude = { 'node_modules', '.git', 'build', 'dist', '.next', '__pycache__' }
    
    for root, dirs, files in os.walk(startpath):
        # Filter directories in place to prevent os.walk from entering them
        dirs[:] = [d for d in dirs if d not in exclude]
        
        # Calculate indentation level based on depth
        level = root.replace(startpath, '').count(os.sep)
        indent = ' ' * 4 * level
        
        # Print the directory name
        print(f"{indent}{os.path.basename(root)}/")
        
        # Print files with an extra indent
        sub_indent = ' ' * 4 * (level + 1)
        for f in files:
            print(f"{sub_indent}{f}")

if __name__ == "__main__":
    # Change '.' to the specific path of your React project if needed
    project_path = './src'
    
    if os.path.exists(project_path):
        print(f"Structure for: {project_path}")
        list_files(project_path)
    else:
        print(f"Path '{project_path}' not found. Run this from your project root.")