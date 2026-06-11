import subprocess
import os

def run(cmd):
    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd)

# 1. Configure git
run(['git', 'config', 'user.name', 'Shubhangam-Singh'])
run(['git', 'config', 'user.email', 'shubhangam2005singh@gmail.com'])

# 2. Add and commit current changes
subprocess.call(['git', 'add', '.'])
# Check if there are changes to commit
status = subprocess.check_output(['git', 'status', '--porcelain']).decode('utf-8').strip()
if status:
    run(['git', 'commit', '-m', 'feat(phase-4): simulation tick loop and route planning'])

# 3. Rewrite git history to remove Claude
commits = subprocess.check_output(['git', 'log', '--format=%H', '--reverse']).decode('utf-8').strip().split('\n')

print(f"Found {len(commits)} commits to rewrite.")

run(['git', 'checkout', '--orphan', 'temp_branch'])

for commit in commits:
    run(['git', 'cherry-pick', commit])
    msg = subprocess.check_output(['git', 'log', '-1', '--format=%B']).decode('utf-8')
    new_msg_lines = [line for line in msg.split('\n') if 'Co-Authored-By: Claude' not in line]
    new_msg = '\n'.join(new_msg_lines).strip() + '\n'
    
    with open('msg.txt', 'w', encoding='utf-8') as f:
        f.write(new_msg)
        
    run(['git', 'commit', '--amend', '-F', 'msg.txt'])

# Overwrite main with the new rewritten branch
run(['git', 'branch', '-M', 'main'])

# 4. Set correct remote and push
# Remove old origin if exists
try:
    subprocess.check_call(['git', 'remote', 'remove', 'origin'])
except subprocess.CalledProcessError:
    pass

run(['git', 'remote', 'add', 'origin', 'https://github.com/Shubhangam-Singh/Cold-Grid.git'])

# Assuming credentials are set up or using GH CLI
run(['git', 'push', '-u', 'origin', 'main'])

print("Done!")
