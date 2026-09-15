import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Archive from './pages/Archive';
import Review from './pages/Review';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/review" element={<Review />} />
      </Routes>
    </Router>
  );
}

export default App;