import { useState } from 'react';
import { AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, useMediaQuery, useTheme, IconButton } from '@mui/material';
import { BarChart3, UploadCloud, Library, History, LayoutDashboard, Menu } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: <LayoutDashboard size={20} /> },
    { id: 'importar', label: 'Importar Cupom', icon: <UploadCloud size={20} /> },
    { id: 'produtos', label: 'Produtos Normalizados', icon: <Library size={20} /> },
    { id: 'historico', label: 'Histórico de Compras', icon: <History size={20} /> }
  ];

  const drawerContent = (
    <Box sx={{ width: 260, bgcolor: 'background.paper', height: '100%' }}>
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
          <BarChart3 size={24} /> Consumo Inteligente
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Gestão de Compras & Preços
        </Typography>
      </Box>
      <List sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              onClick={() => {
                setActiveTab(item.id);
                setMobileOpen(false);
              }}
              selected={activeTab === item.id}
              sx={{
                borderRadius: 2.5,
                py: 1.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                  '&:hover': { bgcolor: 'primary.light' }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: activeTab === item.id ? 'primary.contrastText' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2" sx={{ fontWeight: activeTab === item.id ? 'bold' : 500 }}>
                  {item.label}
                </Typography>
              </ListItemText>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      {isMobile ? (
        <>
          <AppBar position="sticky" sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <Toolbar>
              <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
                <Menu />
              </IconButton>
              <Typography variant="h6" color="primary.main" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
                <BarChart3 size={20} /> Consumo Inteligente
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
            {drawerContent}
          </Drawer>
        </>
      ) : (
        <Drawer variant="permanent" open sx={{ '& .MuiDrawer-paper': { width: 260, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}>
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
