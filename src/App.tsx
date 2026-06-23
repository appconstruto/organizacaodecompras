import { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Importar from './pages/Importar';
import Produtos from './pages/Produtos';
import Historico from './pages/Historico';

// Create a premium Material 3 design theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6750A4', // M3 Primary
      light: '#E8DDFF',
      dark: '#21005D',
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: '#625B71', // M3 Secondary
      light: '#E8DEF8',
      contrastText: '#FFFFFF'
    },
    background: {
      default: '#FEF7FF', // M3 Surface Tone
      paper: '#FFFFFF'
    },
    divider: '#CAC4D0'
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 'bold'
    }
  },
  shape: {
    borderRadius: 16 // M3 rounded corners
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 100 // Pill buttons
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #E7E0EC',
          boxShadow: 'none'
        }
      }
    }
  }
});

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'importar':
        return <Importar />;
      case 'produtos':
        return <Produtos />;
      case 'historico':
        return <Historico />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', flexDirection: { xs: 'column', md: 'row' } }}>
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* Main Content Area */}
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            p: { xs: 3, md: 5 }, 
            marginLeft: { md: '260px' },
            maxWidth: '1200px', 
            mx: 'auto', 
            width: '100%' 
          }}
        >
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
