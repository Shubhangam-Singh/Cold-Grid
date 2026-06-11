import subprocess
import os

def run_out(cmd):
    return subprocess.check_output(cmd).decode('utf-8').strip()

# Get all commits in chronological order
commits = run_out(['git', 'log', '--format=%H', '--reverse', 'main']).split('\n')

last_new_commit = None

for commit in commits:
    # Get the original message
    msg = run_out(['git', 'log', '-1', '--format=%B', commit])
    # Remove Claude
    new_msg_lines = [line for line in msg.split('\n') if 'Co-Authored-By: Claude' not in line]
    new_msg = '\n'.join(new_msg_lines).strip() + '\n'
    
    # Get the original tree
    tree = run_out(['git', 'log', '-1', '--format=%T', commit])
    
    # Get the original author name, email, date
    author_name = run_out(['git', 'log', '-1', '--format=%an', commit])
    author_email = run_out(['git', 'log', '-1', '--format=%ae', commit])
    author_date = run_out(['git', 'log', '-1', '--format=%aI', commit]) # ISO format
    
    # Build commit-tree command
    cmd = ['git', 'commit-tree', tree]
    
    # If it has a mapped parent, use it
    if last_new_commit:
        cmd.extend(['-p', last_new_commit])
        
    # Write message to file
    with open('msg.txt', 'w', encoding='utf-8') as f:
        f.write(new_msg)
        
    env = os.environ.copy()
    env['GIT_AUTHOR_NAME'] = author_name
    env['GIT_AUTHOR_EMAIL'] = author_email
    env['GIT_AUTHOR_DATE'] = author_date
    env['GIT_COMMITTER_NAME'] = "Shubhangam-Singh"
    env['GIT_COMMITTER_EMAIL'] = "shubhangam2005singh@gmail.com"
    
    with open('msg.txt', 'rb') as f:
        new_commit = subprocess.check_output(cmd, stdin=f, env=env).decode('utf-8').strip()
        
    last_new_commit = new_commit

# Point main to the new last commit
subprocess.check_call(['git', 'branch', '-f', 'main', last_new_commit])
subprocess.check_call(['git', 'checkout', 'main'])

# Cleanup and setup remote
if os.path.exists('msg.txt'):
    os.remove('msg.txt')

try:
    subprocess.check_call(['git', 'remote', 'remove', 'origin'])
except:
    pass

subprocess.check_call(['git', 'remote', 'add', 'origin', 'https://github.com/Shubhangam-Singh/Cold-Grid.git'])
subprocess.check_call(['git', 'push', '-u', 'origin', 'main'])
print("Success!")
