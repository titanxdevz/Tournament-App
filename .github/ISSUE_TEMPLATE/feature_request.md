name: Feature Request
description: Submit a proposal for a new feature, optimization, or extension of the platform.
labels: [enhancement, feature-request]
body:
  - type: textarea
    id: problem-statement
    attributes:
      label: Problem Statement
      description: Is your feature request related to a problem or limitation? Please describe.
      placeholder: E.g., It is difficult to analyze...
    validations:
      required: true
  - type: textarea
    id: proposed-solution
    attributes:
      label: Proposed Solution
      description: Provide a detailed description of what you want to happen.
      placeholder: Describe the requested feature...
    validations:
      required: true
  - type: textarea
    id: design-alternatives
    attributes:
      label: Technical Design and Alternatives
      description: Describe any alternative approaches or workarounds you have considered.
    validations:
      required: false
  - type: textarea
    id: additional-context
    attributes:
      label: Additional Context
      description: Add any other context, mockup designs, or workflow charts about the feature request here.
    validations:
      required: false
