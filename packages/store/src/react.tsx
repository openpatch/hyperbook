import { PureComponent, ReactNode } from "react";
import type { Persistor } from "redux-persist";

type Props = {
  onBeforeLift?: () => void;
  children: ReactNode | ((state: boolean) => ReactNode);
  loading: ReactNode;
  persistor: Persistor;
};

type State = {
  bootstrapped: boolean;
};

export class PersistGate extends PureComponent<Props, State> {
  static defaultProps = {
    children: null,
    loading: null,
  };

  state = {
    bootstrapped: false,
  };
  _unsubscribe?: () => void;

  componentDidMount(): void {
    this._unsubscribe = this.props.persistor.subscribe(
      this.handlePersistorState
    );
    this.handlePersistorState();
  }

  handlePersistorState = (): void => {
    const { persistor } = this.props;
    const { bootstrapped } = persistor.getState();
    if (bootstrapped) {
      if (this.props.onBeforeLift) {
        Promise.resolve(this.props.onBeforeLift()).finally(() =>
          this.setState({ bootstrapped: true })
        );
      } else {
        this.setState({ bootstrapped: true });
      }
      this._unsubscribe && this._unsubscribe();
    }
  };

  componentWillUnmount(): void {
    this._unsubscribe && this._unsubscribe();
  }

  render(): ReactNode {
    if (typeof this.props.children === "function") {
      return this.props.children(this.state.bootstrapped);
    }

    return this.state.bootstrapped ? this.props.children : this.props.loading;
  }
}
