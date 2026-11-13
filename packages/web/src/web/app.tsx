import { Route, Switch } from "wouter";
import Index from "./pages/index";
import { Provider } from "./components/provider";
import AuthPage from "./pages/auth-page";
import { AuthBootstrap, PrivateAgenda } from "./components/auth-gate";
import { AccessProvider } from "./components/access-provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <AuthBootstrap>
        <Switch>
          <Route path="/" component={AuthPage} />
          <Route path="/entrar" component={AuthPage} />
          <Route path="/demo">
            <AccessProvider demo={true}>
              <Index />
            </AccessProvider>
          </Route>
          <Route path="/agenda">
            <PrivateAgenda>
              <Index />
            </PrivateAgenda>
          </Route>
          <Route>
            <AuthPage />
          </Route>
        </Switch>
      </AuthBootstrap>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
