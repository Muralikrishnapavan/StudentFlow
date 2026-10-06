#!/usr/bin/env python3
"""
package-lambda.py — Packages the StudentFlow Automation Lambda function
including its implementation (index.js) and production AWS SDK v3 dependencies (node_modules).
Creates aws/dist/studentflow-automation.zip.
"""

import os
import sys
import zipfile
import subprocess

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAMBDA_DIR = os.path.join(ROOT_DIR, 'aws', 'lambda', 'automation')
DIST_DIR = os.path.join(ROOT_DIR, 'aws', 'dist')
ZIP_PATH = os.path.join(DIST_DIR, 'studentflow-automation.zip')

def package_lambda():
    print("=" * 60)
    print("[*] StudentFlow Lambda Packaging Tool")
    print("=" * 60)

    # 1. Verify source files
    index_path = os.path.join(LAMBDA_DIR, 'index.js')
    package_json = os.path.join(LAMBDA_DIR, 'package.json')
    if not os.path.exists(index_path):
        print(f"[!] Error: {index_path} not found!")
        sys.exit(1)
    if not os.path.exists(package_json):
        print(f"[!] Error: {package_json} not found!")
        sys.exit(1)

    # 2. Verify node_modules / AWS SDK dependencies
    node_modules = os.path.join(LAMBDA_DIR, 'node_modules')
    required_deps = [
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/lib-dynamodb',
        '@aws-sdk/client-sns'
    ]
    for dep in required_deps:
        dep_path = os.path.join(node_modules, *dep.split('/'))
        if not os.path.exists(dep_path):
            print(f"[!] Dependency {dep} missing. Running npm install...")
            npm_cmd = 'npm.cmd' if os.name == 'nt' else 'npm'
            subprocess.run([npm_cmd, 'install', '--omit=dev'], cwd=LAMBDA_DIR, check=True)
            break

    # 3. Create dist directory
    os.makedirs(DIST_DIR, exist_ok=True)
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

    # 4. Create ZIP archive
    print(f"\n[*] Creating deployment archive: {ZIP_PATH}")
    files_added = 0
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(LAMBDA_DIR):
            # Skip test directory and hidden files
            dirs[:] = [d for d in dirs if d not in ('test', '.git')]
            for file in files:
                if file.startswith('.') or file.endswith('.log') or file.endswith('.md'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, LAMBDA_DIR)
                zipf.write(file_path, arcname)
                files_added += 1

    size_kb = os.path.getsize(ZIP_PATH) / 1024
    print(f"[+] Archive created successfully!")
    print(f"    Files packaged: {files_added}")
    print(f"    Archive size:   {size_kb:.2f} KB ({size_kb/1024:.2f} MB)")

    # 5. Verify archive structure
    with zipfile.ZipFile(ZIP_PATH, 'r') as zipf:
        namelist = zipf.namelist()
        has_index = 'index.js' in namelist
        has_dynamo = any('client-dynamodb' in name for name in namelist)
        has_sns = any('client-sns' in name for name in namelist)
        print("\n[*] Archive Manifest Verification:")
        print(f"    [+] index.js:                {'PASS' if has_index else 'FAIL'}")
        print(f"    [+] @aws-sdk/client-dynamodb: {'PASS' if has_dynamo else 'FAIL'}")
        print(f"    [+] @aws-sdk/client-sns:      {'PASS' if has_sns else 'FAIL'}")
        if not (has_index and has_dynamo and has_sns):
            print("[!] Archive verification failed!")
            sys.exit(1)

    print("\n[+] Packaging complete! Archive is deployment-ready.")

if __name__ == '__main__':
    package_lambda()
