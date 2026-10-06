#!/usr/bin/env python3
"""
package-api-lambda.py — Packages the StudentFlow-API Lambda function
into aws/dist/studentflow-api.zip.

The package includes:
  - index.js (AWS Lambda serverless-http entry point)
  - app.js (Express application setup)
  - routes/ (auth.js, tasks.js)
  - middleware/ (auth.js)
  - utils/ (dynamoDb.js, db.js)
  - package.json
  - node_modules/ (express, serverless-http, AWS SDK v3, bcryptjs, jsonwebtoken, etc.)
"""

import os
import sys
import zipfile

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAMBDA_API_DIR = os.path.join(ROOT_DIR, 'aws', 'lambda', 'api')
BACKEND_DIR = os.path.join(ROOT_DIR, 'backend')
DIST_DIR = os.path.join(ROOT_DIR, 'aws', 'dist')
ZIP_PATH = os.path.join(DIST_DIR, 'studentflow-api.zip')

def package_api_lambda():
    print("=" * 60)
    print("[*] StudentFlow API Lambda Packaging Tool")
    print("=" * 60)

    # 1. Verify required source files
    required_files = [
        os.path.join(LAMBDA_API_DIR, 'index.js'),
        os.path.join(BACKEND_DIR, 'app.js'),
        os.path.join(BACKEND_DIR, 'routes', 'auth.js'),
        os.path.join(BACKEND_DIR, 'routes', 'tasks.js'),
        os.path.join(BACKEND_DIR, 'middleware', 'auth.js'),
        os.path.join(BACKEND_DIR, 'utils', 'dynamoDb.js'),
        os.path.join(BACKEND_DIR, 'utils', 'db.js'),
    ]

    for f in required_files:
        if not os.path.exists(f):
            print(f"[!] Error: Required file missing: {f}")
            sys.exit(1)

    node_modules_dir = os.path.join(BACKEND_DIR, 'node_modules')
    if not os.path.exists(node_modules_dir):
        print(f"[!] Error: backend/node_modules directory missing!")
        sys.exit(1)

    # 2. Ensure dist directory exists
    os.makedirs(DIST_DIR, exist_ok=True)
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

    # 3. Create ZIP archive
    print(f"\n[*] Creating API Lambda deployment archive: {ZIP_PATH}")
    files_added = 0

    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add index.js at the root of the ZIP
        zipf.write(os.path.join(LAMBDA_API_DIR, 'index.js'), 'index.js')
        files_added += 1

        # Add app.js at the root of the ZIP
        zipf.write(os.path.join(BACKEND_DIR, 'app.js'), 'app.js')
        files_added += 1

        # Add package.json
        pkg_path = os.path.join(LAMBDA_API_DIR, 'package.json')
        if os.path.exists(pkg_path):
            zipf.write(pkg_path, 'package.json')
            files_added += 1

        # Add backend directories: routes, middleware, utils
        for subfolder in ['routes', 'middleware', 'utils']:
            folder_path = os.path.join(BACKEND_DIR, subfolder)
            for root, dirs, files in os.walk(folder_path):
                for f in files:
                    if f.startswith('.') or f.endswith('.log'):
                        continue
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, BACKEND_DIR)
                    zipf.write(full_path, rel_path)
                    files_added += 1

        # Add node_modules (excluding dev dependencies / caches if any)
        exclude_modules = {'.bin', 'nodemon', '.cache'}
        for root, dirs, files in os.walk(node_modules_dir):
            rel_to_modules = os.path.relpath(root, node_modules_dir)
            top_module = rel_to_modules.split(os.sep)[0]
            if top_module in exclude_modules:
                dirs[:] = []
                continue

            for f in files:
                if f.startswith('.') or f.endswith('.md') or f.endswith('.ts') or f.endswith('.map'):
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, BACKEND_DIR)
                zipf.write(full_path, rel_path)
                files_added += 1

    size_kb = os.path.getsize(ZIP_PATH) / 1024
    print(f"[+] Archive created successfully!")
    print(f"    Files packaged: {files_added}")
    print(f"    Archive size:   {size_kb:.2f} KB ({size_kb/1024:.2f} MB)")

    # 4. Verify archive structure
    with zipfile.ZipFile(ZIP_PATH, 'r') as zipf:
        namelist = zipf.namelist()
        has_index = 'index.js' in namelist
        has_app = 'app.js' in namelist
        has_auth_route = any('routes/auth.js' in name or 'routes\\auth.js' in name for name in namelist)
        has_dynamo = any('utils/dynamoDb.js' in name or 'utils\\dynamoDb.js' in name for name in namelist)
        has_serverless_http = any('serverless-http' in name for name in namelist)
        has_dynamo_client = any('client-dynamodb' in name for name in namelist)

        print("\n[*] Archive Manifest Verification:")
        print(f"    [+] index.js:                {'PASS' if has_index else 'FAIL'}")
        print(f"    [+] app.js:                  {'PASS' if has_app else 'FAIL'}")
        print(f"    [+] routes/auth.js:          {'PASS' if has_auth_route else 'FAIL'}")
        print(f"    [+] utils/dynamoDb.js:       {'PASS' if has_dynamo else 'FAIL'}")
        print(f"    [+] serverless-http:         {'PASS' if has_serverless_http else 'FAIL'}")
        print(f"    [+] @aws-sdk/client-dynamodb:{'PASS' if has_dynamo_client else 'FAIL'}")

        if not (has_index and has_app and has_auth_route and has_dynamo and has_serverless_http and has_dynamo_client):
            print("[!] Archive verification failed!")
            sys.exit(1)

    print("\n[+] Packaging complete! StudentFlow-API archive is deployment-ready.")

if __name__ == '__main__':
    package_api_lambda()
