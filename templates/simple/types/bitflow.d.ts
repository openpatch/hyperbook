import "@bitflow/core";
import {
  Task,
  End,
  Input,
  Start,
  Title,
  TaskAnswer,
  TaskResult,
  TaskStatistic,
} from "@bitflow/bits";

declare global {
  namespace Bitflow {
    export type Task = Task;
    export type TaskAnswer = TaskAnswer;
    export type TaskResult = TaskResult;
    export type TaskStatistic = TaskStatistic;
    export type Input = Input;
    export type Title = TitleS;
    export type Start = Start;
    export type End = End;
  }
}
