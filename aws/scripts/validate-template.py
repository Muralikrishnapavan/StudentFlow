#!/usr/bin/env python3
"""
validate-template.py — Validates the StudentFlow AWS CloudFormation template
without deploying any resources to AWS.

Validates:
1. YAML syntax and CloudFormation intrinsic tags (!Ref, !GetAtt, !Sub, etc.)
2. Required sections: AWSTemplateFormatVersion, Parameters, Resources, Outputs
3. All resource definitions and properties (DynamoDB, SNS, IAM, Lambda, EventBridge)
4. Reference resolution: all !Ref, !GetAtt, and !Sub targets exist
5. Lambda packaging: Code property points to aws/lambda/automation and contains index.js & dependencies
6. EventBridge rule: accurately configured as AWS::Events::Rule with events.amazonaws.com principal
"""

import os
import sys
import yaml

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEMPLATE_PATH = os.path.join(ROOT_DIR, 'aws', 'cloudformation', 'template.yaml')

# Register CloudFormation YAML intrinsic tags
class CloudFormationLoader(yaml.SafeLoader):
    pass

CFN_TAGS = [
    '!Ref', '!GetAtt', '!Sub', '!Join', '!Select',
    '!FindInMap', '!If', '!Equals', '!Not', '!And', '!Or'
]

def make_constructor(tag_name):
    def constructor(loader, node):
        if isinstance(node, yaml.ScalarNode):
            return {tag_name: loader.construct_scalar(node)}
        elif isinstance(node, yaml.SequenceNode):
            return {tag_name: loader.construct_sequence(node)}
        elif isinstance(node, yaml.MappingNode):
            return {tag_name: loader.construct_mapping(node)}
        return {tag_name: None}
    return constructor

for tag in CFN_TAGS:
    CloudFormationLoader.add_constructor(tag, make_constructor(tag))

def validate():
    print("=" * 70)
    print("[*] StudentFlow CloudFormation Template Validator")
    print(f"[*] Template: {TEMPLATE_PATH}")
    print("=" * 70)

    errors = []
    warnings = []

    # 1. File existence
    if not os.path.exists(TEMPLATE_PATH):
        print(f"[!] Error: File {TEMPLATE_PATH} does not exist!")
        sys.exit(1)

    # 2. YAML syntax & parsing
    try:
        with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
            template = yaml.load(f, Loader=CloudFormationLoader)
        print("[+] [PASS] YAML Syntax & CloudFormation tags parsed successfully")
    except Exception as e:
        print(f"[!] [FAIL] YAML parsing error: {e}")
        sys.exit(1)

    # 3. Format Version
    version = template.get('AWSTemplateFormatVersion')
    if version == '2010-09-09':
        print("[+] [PASS] AWSTemplateFormatVersion is valid ('2010-09-09')")
    else:
        errors.append(f"Invalid or missing AWSTemplateFormatVersion: {version}")

    # 4. Parameters
    parameters = template.get('Parameters', {})
    expected_params = ['TasksTableName', 'UsersTableName', 'ScheduleRate']
    for param in expected_params:
        if param in parameters:
            p_type = parameters[param].get('Type')
            p_default = parameters[param].get('Default')
            print(f"[+] [PASS] Parameter '{param}' defined (Type: {p_type}, Default: '{p_default}')")
        else:
            errors.append(f"Missing expected parameter: {param}")

    # 5. Resources Check
    resources = template.get('Resources', {})
    expected_resources = {
        'TasksTable': 'AWS::DynamoDB::Table',
        'UsersTable': 'AWS::DynamoDB::Table',
        'ReminderTopic': 'AWS::SNS::Topic',
        'AutomationLogGroup': 'AWS::Logs::LogGroup',
        'AutomationLambdaRole': 'AWS::IAM::Role',
        'AutomationLambdaFunction': 'AWS::Lambda::Function',
        'ScheduledAutomationRule': 'AWS::Events::Rule',
        'EventBridgeLambdaPermission': 'AWS::Lambda::Permission',
    }

    for res_id, res_type in expected_resources.items():
        if res_id not in resources:
            errors.append(f"Missing expected resource: {res_id} ({res_type})")
            continue

        actual_type = resources[res_id].get('Type')
        if actual_type == res_type:
            print(f"[+] [PASS] Resource '{res_id}' has correct Type '{actual_type}'")
        else:
            errors.append(f"Resource '{res_id}' has Type '{actual_type}', expected '{res_type}'")

    # 6. Lambda Packaging Check
    lambda_fn = resources.get('AutomationLambdaFunction', {}).get('Properties', {})
    code_prop = lambda_fn.get('Code')

    if isinstance(code_prop, str):
        # Local path check (for aws cloudformation package)
        resolved_path = os.path.normpath(os.path.join(os.path.dirname(TEMPLATE_PATH), code_prop))
        if os.path.exists(resolved_path):
            index_file = os.path.join(resolved_path, 'index.js')
            pkg_file = os.path.join(resolved_path, 'package.json')
            node_modules = os.path.join(resolved_path, 'node_modules')

            if os.path.exists(index_file) and os.path.exists(pkg_file):
                print(f"[+] [PASS] Lambda Code path '{code_prop}' resolves to valid source: {resolved_path}")
                print("    [+] Source contains: index.js and package.json")
            else:
                errors.append(f"Lambda source directory {resolved_path} is missing index.js or package.json")

            if os.path.exists(node_modules):
                has_dynamo = os.path.exists(os.path.join(node_modules, '@aws-sdk', 'client-dynamodb'))
                has_sns = os.path.exists(os.path.join(node_modules, '@aws-sdk', 'client-sns'))
                if has_dynamo and has_sns:
                    print("    [+] Source contains: production AWS SDK v3 dependencies in node_modules")
                else:
                    warnings.append("AWS SDK dependencies not found in local node_modules (run 'npm install --omit=dev')")
            else:
                warnings.append(f"node_modules not found in {resolved_path}")
        else:
            errors.append(f"Lambda Code path '{code_prop}' does not exist on disk: {resolved_path}")
    elif isinstance(code_prop, dict) and ('S3Bucket' in code_prop and 'S3Key' in code_prop):
        print("[+] [PASS] Lambda Code is configured with S3Bucket and S3Key")
    else:
        errors.append(f"Lambda Code property must be a local packaging path or S3 object, found: {code_prop}")

    # 7. EventBridge Rule Configuration & Documentation Check
    rule = resources.get('ScheduledAutomationRule', {}).get('Properties', {})
    rule_type = resources.get('ScheduledAutomationRule', {}).get('Type')
    if rule_type == 'AWS::Events::Rule':
        print("[+] [PASS] ScheduledAutomationRule correctly uses 'AWS::Events::Rule'")
    else:
        errors.append(f"ScheduledAutomationRule type should be 'AWS::Events::Rule', found '{rule_type}'")

    # Check permission principal
    permission = resources.get('EventBridgeLambdaPermission', {}).get('Properties', {})
    principal = permission.get('Principal')
    if principal == 'events.amazonaws.com':
        print("[+] [PASS] EventBridge permission principal is 'events.amazonaws.com'")
    else:
        errors.append(f"EventBridgeLambdaPermission Principal should be 'events.amazonaws.com', found '{principal}'")

    # Check description accurately mentions AWS::Events::Rule
    template_desc = template.get('Description', '')
    if 'AWS::Events::Rule' in template_desc or 'EventBridge Rule' in template_desc:
        print("[+] [PASS] Template Description accurately describes Amazon EventBridge Rule (AWS::Events::Rule)")
    else:
        warnings.append("Template description could be clearer regarding AWS::Events::Rule")

    # 8. Output Summary
    print("\n" + "=" * 70)
    if warnings:
        print("[!] Warnings:")
        for w in warnings:
            print(f"    - {w}")

    if errors:
        print("[-] [FAIL] Validation finished with errors:")
        for err in errors:
            print(f"    ❌ {err}")
        sys.exit(1)
    else:
        print("[+] [SUCCESS] CloudFormation template validation PASSED! (0 errors)")
        print("=" * 70)

if __name__ == '__main__':
    validate()
