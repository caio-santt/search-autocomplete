import { ApolloProvider } from '@apollo/client';
import { client } from './apollo';
import { Autocomplete } from './components/Autocomplete';

export default function App() {
  return (
    <ApolloProvider client={client}>
      <Autocomplete />
    </ApolloProvider>
  );
}
