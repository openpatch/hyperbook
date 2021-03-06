import "../reset.css";
import "../styles.css";
import "../light.css";
import { useStore } from "../store";
import { persistStore } from "redux-persist";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

export default function MyApp({ Component, pageProps }) {
  const store = useStore(pageProps.initialReduxState);
  const persistor = persistStore(store, {}, function () {
    persistor.persist();
  });

  return (
    <Provider store={store}>
      <PersistGate
        loading={<div className="loading">...</div>}
        persistor={persistor}
      >
        <Component {...pageProps} />;
      </PersistGate>
    </Provider>
  );
}
