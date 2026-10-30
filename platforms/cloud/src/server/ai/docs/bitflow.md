# Hyperbook Bitflow Assessment Generation

Your task is to create complete, valid, pedagogically meaningful Bitflow assessments for Hyperbook.

Bitflow is an interactive assessment system in which learners work through a sequence of questions, tasks, explanations, and feedback screens.

You must generate two coordinated outputs:
1. A valid `.bitflow` JSON file containing the assessment.
2. A Hyperbook `::bitflow` directive embedding that file.

## 1. Required Output Format

A Bitflow assessment is embedded in Hyperbook using:

```markdown
::bitflow{src="quiz.bitflow"}
```

You may also specify additional attributes:

```markdown
::bitflow{id="quiz-1" height="600px" src="quiz.bitflow" locale="en"}
```

Supported attributes:

- `id`: Unique identifier for the embedded assessment.
- `height`: Assessment height. Default is `600px`. Supports `auto`.
- `maxHeight`: Maximum height when using automatic sizing.
- `src`: Path to the `.bitflow` JSON file.
- `locale`: Interface language, such as `en` or `de`.

Do not put the assessment JSON directly inside the directive.

## 2. File Creation

Every assessment requires a separate `.bitflow` file.

You MUST use the `write_file` tool to create the JSON file in the same proposal as the Hyperbook Markdown document.

Example:

**File: `quiz.bitflow`**

The file must contain valid JSON.

**Hyperbook Markdown:**

```markdown
::bitflow{id="quiz-1" height="600px" src="quiz.bitflow" locale="en"}
```

File resolution follows this order:

1. `public/`
2. `book/`
3. Next to the current page.

Use a suitable relative path in the `src` attribute.

Ensure that the file path and directive reference match exactly.

## 3. Bitflow JSON Structure

Every `.bitflow` file must follow the official Bitflow schema.

The basic structure is:

```json
{
  "version": 1,
  "meta": {
    "id": "assessment-1",
    "title": "Assessment title",
    "description": "Assessment description",
    "locale": "en"
  },
  "nodes": [],
  "edges": []
}
```

Required top-level properties:

- `version`: Always the number `1`.
- `meta`: Assessment metadata.
- `nodes`: Assessment steps.
- `edges`: Connections between steps.

The optional `viewport` property is intended for the editor and should normally be omitted.

## 4. Assessment Structure

A Bitflow assessment is a directed graph consisting of nodes and edges.

Use the appropriate node types:

### Start nodes
- `start-simple`
- `start-consent`
- `start-identify`

### Content nodes
- `title-simple`
- `input-markdown`

### Task nodes
- `task-choice`
- `task-yes-no`
- `task-input`
- `task-numeric`
- `task-math`

Use other officially supported task types when appropriate.

### End nodes
- `end-tries`
- `end-certificate`
- `end-download`
- `end-handoff`

Always consult the official documentation for the complete list of supported node types and their required data structures.

## 5. Node and Edge Requirements

Every node must have:

- A unique `id`.
- A valid `type`.
- A `position` containing numeric `x` and `y` coordinates.
- A `data` object containing the required configuration for its bit type.

Every edge must have:

- A unique `id`.
- A valid `source` node.
- A valid `target` node.

Use edges to establish the assessment flow.

Important rules:

- Exactly one node must have no incoming edge.
- Every node must be reachable from the starting node.
- Every node except an end node must have at least one outgoing edge.
- Every edge must reference existing nodes.
- Branching edges must use valid conditions.
- Include an unconditional fallback edge for conditional branches.

Use conditional branching when it improves the learning experience.

## 6. Educational Assessment Design

Design assessments with a clear pedagogical progression.

A typical assessment should contain:

1. An introductory screen.
2. Questions testing prerequisite knowledge.
3. Questions introducing or exploring the main concept.
4. More challenging application questions.
5. Explanations or remediation when appropriate.
6. A concluding screen with results and feedback.

Adapt the number and difficulty of questions to the user's request.

Questions should:
- Be clearly worded.
- Test meaningful learning objectives.
- Have unambiguous correct answers.
- Use plausible distractors.
- Avoid trick questions unless explicitly requested.
- Provide useful feedback.
- Progress logically in difficulty.

Do not create repetitive questions merely to increase the assessment length.

## 7. Evaluation and Feedback

Task nodes should contain an appropriate `evaluation` object.

Example:

```json
{
  "mode": "auto",
  "enableRetry": true,
  "showFeedback": true,
  "weight": 1
}
```

Use appropriate evaluation settings.

Provide meaningful feedback for correct and incorrect answers wherever supported.

For mathematical assessments:
- Verify all correct answers.
- Check numerical tolerances.
- Use appropriate units.
- Account for equivalent mathematical representations.
- Avoid overly restrictive answer matching.

Never expose incorrect answers or contradictory feedback.

## 8. Conditional Learning Paths

Use Bitflow conditions to create adaptive assessments when useful.

Supported condition types include:

- `always`
- `compare`
- `and`
- `or`
- `not`

Supported comparison operators include:

- `eq`
- `ne`
- `gt`
- `gte`
- `lt`
- `lte`
- `in`
- `notIn`
- `isTrue`

Possible values include:
- Answers.
- Grading results.
- Number of attempts.
- Number of visits.
- Confidence.
- Time spent.
- Remaining time.
- Score.
- Score ratio.

Make sure conditions reference existing nodes and use valid value references.

For adaptive assessments, consider:
- Remediation after incorrect answers.
- Additional challenges after correct answers.
- Different feedback depending on confidence.
- Retry loops with appropriate limits.

## 9. Mathematical Content

For mathematical assessments, use Markdown and TeX notation inside supported text fields.

Examples:

Inline mathematics:

`$f(x)=x^2$`

Displayed mathematics:

`$$f'(x)=2x$$`

Ensure that:
- Mathematical notation is correct.
- Questions are mathematically accurate.
- Solutions are verified.
- Units are consistent.
- Numerical answers use suitable tolerances.
- Mathematical expressions are rendered correctly.

## 10. JSON Quality and Validation

The `.bitflow` file must be valid JSON.

Never include:
- JavaScript comments.
- Trailing commas.
- Undefined values.
- Functions.
- Markdown code fences inside the JSON file.

Use double quotes for JSON keys and string values.

Before completing an assessment, verify:

1. JSON syntax is valid.
2. The version is `1`.
3. Metadata is correctly defined.
4. Node IDs are unique.
5. Edge IDs are unique.
6. All node references exist.
7. All nodes are reachable.
8. The graph has exactly one starting node.
9. Every non-end node has an outgoing edge.
10. Every bit type uses the correct data schema.
11. Evaluation settings are valid.
12. Conditional branches are logically correct.
13. Correct answers and feedback are consistent.

When available, use Bitflow's `validateFlow()` functionality or an equivalent validation tool to check the generated document. Parsing alone is insufficient because per-bit data schemas also need validation.

## 11. Documentation

When uncertain about the JSON schema, node types, evaluation settings, conditions, or other Bitflow functionality, call `read_docs` with `bitflow-full` — the official bitflow llms.txt, vendored locally in this platform.

Never invent unsupported bit types, attributes, fields, or condition structures.

## 12. Final Output

When generating an assessment:

1. Create the complete `.bitflow` JSON file using `write_file`.
2. Validate the JSON structure and assessment graph.
3. Create the corresponding Hyperbook `::bitflow` directive.
4. Ensure the `src` path points to the correct file.
5. Include the directive in the Hyperbook Markdown document.

Do not output the JSON as a substitute for creating the actual file.

Do not generate a directive that references a file that has not been created.

## Guiding Principle

Create complete, pedagogically sound, technically valid Bitflow assessments that integrate directly into Hyperbook.

**The JSON file defines the assessment. The Hyperbook directive embeds it. Both must be created correctly and work together.**
