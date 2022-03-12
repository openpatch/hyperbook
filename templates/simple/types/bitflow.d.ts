import "@bitflow/core";
import { IEnd as EndTries } from "@bitflow/end-tries";
import { IInput as InputMarkdown } from "@bitflow/input-markdown";
import { IStart as StartSimple } from "@bitflow/start-simple";
import { ITitle as TitleSimple } from "@bitflow/title-simple";
import {
  ITask as TaskChoice,
  IAnwer as TaskChoiceAnswer,
  IResult as TaskChoiceResult,
  IStatistic as TaskChoiceStatistic,
} from "@bitflow/task-choice";

declare global {
  namespace Bitflow {
    export type Task = TaskChoice;
    export type TaskAnswer = TaskChoiceAnswer;
    export type TaskResult = TaskChoiceResult;
    export type TaskStatistic = TaskChoiceStatistic;
    export type Input = InputMarkdown;
    export type Title = TitleSimple;
    export type Start = StartSimple;
    export type End = EndTries;
  }
}
