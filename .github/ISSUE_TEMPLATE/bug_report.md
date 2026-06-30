name: Bug Report
description: Report a bug or issue in the application to help us improve the platform stability.
labels: [bug, triage]
body:
  - type: markdown
    attributes:
      value: |
        Please provide a clear and concise description of the issue. Ensure no sensitive customer credentials, credentials, or API keys are posted in logs.
  - type: textarea
    id: problem-description
    attributes:
      label: Bug Description
      description: A clear and concise description of what the bug is.
      placeholder: Describe the defect here...
    validations:
      required: true
  - type: textarea
    id: steps-reproduce
    attributes:
      label: Steps to Reproduce
      description: Provide step-by-step instructions to reproduce the issue.
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
    validations:
      required: true
  - type: textarea
    id: expected-behavior
    attributes:
      label: Expected Behavior
      description: Describe what you expected to happen.
      placeholder: What should have happened...
    validations:
      required: true
  - type: dropdown
    id: environment-scope
    attributes:
      label: Affected Component
      options:
        - Backend API
        - Next.js Admin Panel
        - Flutter Mobile Client
        - Static Marketing Site
    validations:
      required: true
  - type: textarea
    id: system-logs
    attributes:
      label: System Logs and Screenshots
      description: Provide error logs, stack traces, console outputs, or drag-and-drop screenshots here.
      render: bash
    validations:
      required: false
  - type: input
    id: version-info
    attributes:
      label: Software/Environment Versions
      description: E.g., Flutter 3.22, Node 20.11, Chrome 122, Android API 34.
    validations:
      required: true
