# Hyperbook JMP Diagram Generation

Your task is to generate valid, educational Java Memory Playground (JMP) diagrams for Hyperbook.

JMP visualizes Java memory structures, including:
- Stack frames
- Local variables
- Heap objects
- Object references
- Arrays
- Strings
- Null references
- Garbage collection
- Method calls and returns

You must generate a `.jmp` JSON file and embed it using Hyperbook's `::jmp` directive.

## 1. Required Output Format

Use the following Hyperbook directive:

```markdown
::jmp{src="memory.jmp"}
```

You may also specify:

```markdown
::jmp{id="jmp-1" height="600px" src="memory.jmp"}
```

Supported attributes:
- `id`: Unique identifier for the embedded diagram.
- `height`: Height of the diagram. Default is `600px`.
- `src`: Path to the `.jmp` file.

Do not put the JSON directly inside the directive.

## 2. File Creation

Every JMP visualization requires a separate `.jmp` file.

You MUST use the `write_file` tool to create the file in the same proposal as the Hyperbook Markdown document.

Example:

**File: `memory.jmp`**

Contains the complete JMP JSON diagram.

**Hyperbook Markdown:**

```markdown
::jmp{id="jmp-1" height="600px" src="memory.jmp"}
```

File resolution:
1. `public/`
2. `book/`
3. Next to the current page.

Ensure that the `src` attribute points to the correct file.

## 3. JMP JSON Structure

A `.jmp` file contains one JSON object.

The general structure is:

```json
{
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "options": {},
  "klasses": {},
  "steps": []
}
```

The main properties are:

- `viewport`: Canvas position and zoom.
- `options`: Diagram configuration.
- `klasses`: Java class definitions.
- `steps`: Sequence of memory states.

For a single-step diagram, `objects`, `variables`, and `methodCalls` may also be placed directly at the top level.

Use 2-space indentation.

## 4. Java Class Definitions

Define classes under `klasses`.

Example:

```json
{
  "klasses": {
    "Person": {
      "attributes": {
        "name": "String",
        "age": "int",
        "friend": "Person"
      }
    }
  }
}
```

Rules:
- Declare all relevant fields.
- Use correct Java data types.
- Preserve the field order from the Java source.
- Use primitive types for primitive fields.
- Use class names for reference fields.
- Include referenced classes when necessary.

## 5. Heap Objects

Objects belong in the `objects` section of a step.

Example:

```json
{
  "@p1": {
    "klass": "Person",
    "attributes": {
      "name": {
        "dataType": "String"
      },
      "age": {
        "dataType": "int",
        "value": 25
      },
      "friend": {
        "dataType": "Person"
      }
    },
    "position": {
      "x": 320,
      "y": 60
    }
  }
}
```

Rules:
- Every object needs a unique address.
- Use short, stable IDs such as `@a1`, `@p1`, or `@node1`.
- The `klass` must match a class in `klasses`, except for special built-in objects such as `Array`.
- Attributes must match the declared class fields.
- Primitive values are stored inline.
- Reference values contain the address of another object.
- Omit `value` for null references.

## 6. Stack Frames and Variables

Method calls belong in `methodCalls`.

Example:

```json
{
  "@f1": {
    "name": "Main.main",
    "index": 0,
    "localVariables": {
      "person": {
        "dataType": "Person",
        "value": "@p1"
      },
      "number": {
        "dataType": "int",
        "value": 10
      }
    },
    "position": {
      "x": 20,
      "y": 40
    }
  }
}
```

Rules:
- `name` must identify the Java method.
- `index` represents stack depth.
- `main` normally has index `0`.
- Nested calls have increasing indexes.
- Local variables must use the correct Java data types.
- Reference variables must point to existing heap objects.
- Declare local variables as soon as their stack frame exists.

## 7. References and Memory Semantics

Correctly represent Java's memory model.

Pay particular attention to:

- Primitive values are copied when assigned.
- Object references are copied, not the objects themselves.
- Multiple variables can reference the same object.
- Assigning `null` removes a reference.
- Object fields can reference other heap objects.
- Local variables belong to stack frames.
- Objects are allocated on the heap.
- Returning from a method removes its stack frame.
- Unreachable objects can become eligible for garbage collection.

Never confuse an object with a reference to that object.

Never represent an object variable as containing the object's fields directly.

## 8. Arrays and Strings

### Arrays

Arrays use the special class name `Array`.

Example:

```json
{
  "@arr1": {
    "klass": "Array",
    "arrayElementType": "int",
    "attributes": {
      "length": {
        "dataType": "int",
        "value": 3
      },
      "[0]": {
        "dataType": "int",
        "value": 4
      },
      "[1]": {
        "dataType": "int",
        "value": 8
      },
      "[2]": {
        "dataType": "int",
        "value": 15
      }
    },
    "position": {
      "x": 320,
      "y": 200
    }
  }
}
```

Rules:
- Include `arrayElementType`.
- Declare `length` first.
- Declare elements in index order.
- Make the length match the number of elements.
- Arrays of objects must contain references or null values.

### Strings

Strings are reference objects.

Example:

```json
{
  "@s1": {
    "klass": "String",
    "literal": "Hello",
    "attributes": {},
    "position": {
      "x": 640,
      "y": 60
    }
  }
}
```

Use `literal` for the String content without quotation marks.

Represent String references like other object references.

Use `inlineStrings: false` when the lesson specifically concerns String identity, object sharing, the String pool, or `==` versus `.equals()`.

## 9. Memory Traces and Steps

Whenever a visualization explains how a Java program executes, prefer multiple steps over one static diagram.

Each step represents one moment in the program.

Example:

```json
{
  "steps": [
    {
      "label": "Person p = new Person();",
      "objects": {},
      "variables": {},
      "methodCalls": {
        "@f1": {
          "name": "Main.main",
          "index": 0,
          "localVariables": {
            "p": {
              "dataType": "Person"
            }
          },
          "position": {
            "x": 20,
            "y": 40
          }
        }
      }
    }
  ]
}
```

Important rules:
- Use one step per meaningful Java statement.
- Keep the same object IDs across steps.
- Keep positions stable across steps.
- Introduce a new ID only when a genuinely new object is created.
- Update references when assignments change them.
- Remove returned stack frames.
- Represent object creation and reference assignment as separate steps when this improves understanding.
- Change only what the Java statement actually changes.

Each step should have a meaningful `label` containing the corresponding Java statement.

Use `note` for optional hints or explanations.

## 10. Exercises

When creating an interactive student exercise, mark the target step:

```json
{
  "exercise": true
}
```

Rules:
- Provide the correct solution in the exercise step.
- Give the step a clear instruction in `label`.
- Provide a helpful hint in `note`.
- Ensure the previous step gives students enough information to construct the solution.
- Name variables consistently because exercise checking compares roots by name.
- Ensure all referenced objects are reachable from the relevant variables or stack frames.

Do not reveal the solution in the hint.

## 11. Ordering Exercises

Use `statements` when students should execute assignments in an order of their choice.

Example:

```json
{
  "statements": [
    "neu.next = current.next",
    "current.next = neu"
  ]
}
```

Only use the documented statement grammar:
- Variable names.
- Attribute paths such as `node.next`.
- `null` on the right-hand side.

Do not include arithmetic, method calls, loops, or control flow in statements.

## 12. Visual Layout

JMP uses an infinite canvas with pixel coordinates. There is no automatic layout.

Follow these conventions:

- Stack frames on the left.
- Heap objects on the right.
- Main frame near the top.
- Nested frames arranged vertically.
- Objects arranged from left to right according to reference depth.
- Allow approximately 220px horizontally between boxes.
- Allow approximately 140px vertically between boxes.
- Account for object height based on the number of fields.
- Keep positions consistent across all steps.

Avoid overlapping objects and confusing reference arrows.

## 13. Diagram Options

Use the `options` property to configure the learning environment.

Available options include:

- `hideSidebar`
- `hideCallMethod`
- `hideDeclareGlobalVariable`
- `hideNewArray`
- `disableGarbageCollector`
- `gcPrediction`
- `createNewOnEdgeDrop`
- `inlineStrings`
- `hideSteps`
- `hideStepChanges`

Choose options appropriate to the learning objective.

For example, hide array creation when teaching basic object references.

Use `gcPrediction` when students should predict which objects are unreachable.

## 14. Educational Design

Design diagrams around a clear learning objective.

Common topics include:
- Primitive values versus object references.
- Aliasing.
- Null references.
- Object creation.
- Parameter passing.
- Method calls and returns.
- Recursion.
- Arrays.
- Linked lists.
- String references.
- Garbage collection.
- Reachability.
- Object graphs.

Prefer step-by-step traces for explaining changes in memory.

Use exercise steps when learners should construct memory states themselves.

Keep each diagram focused on one or a small number of related concepts.

## 15. Validation and Accuracy

JMP does not execute Java programs or automatically verify that a diagram matches Java semantics.

Therefore, manually verify every diagram against the corresponding Java code.

Check:
1. Class definitions and field types.
2. Stack frame creation and removal.
3. Correct stack indexes.
4. Primitive values.
5. Heap object creation.
6. Reference assignments.
7. Null references.
8. Array lengths and elements.
9. String representations.
10. Object reachability.
11. Consistent IDs across steps.
12. Consistent positions across steps.
13. Valid references within every step.
14. Correct execution order.

Do not invent memory states or omit important changes.

## 16. Documentation

When uncertain about the file format, object structures, options, exercises, or statements, call `read_docs` with `jmp-full` — the official JMP llms.txt, vendored locally in this platform.

Never invent unsupported JSON properties or structures.

## 17. Final Output

When generating a JMP visualization:

1. Understand the Java code or learning objective.
2. Determine the relevant memory states.
3. Design the class definitions.
4. Create the stack and heap representation.
5. Create a step-by-step trace when appropriate.
6. Validate Java memory semantics.
7. Write the `.jmp` file using `write_file`.
8. Embed it using the Hyperbook `::jmp` directive.
9. Verify that the `src` path matches the created file.

Do not generate a directive referencing a file that has not been created.

**Guiding principle: Create accurate, readable, pedagogically meaningful visual representations of Java memory that integrate directly into Hyperbook.**
