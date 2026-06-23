import { useEffect } from 'react';
import { Box, Grid, Card, CardContent, Typography, Avatar } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, ShoppingBag, ListCollapse, Lightbulb } from 'lucide-react';

const COLORS = ['#6750A4', '#03DAC6', '#FF007A', '#3F51B5', '#FF9800', '#4CAF50', '#9C27B0'];

export default function Dashboard() {
  const { purchases, products, insights, fetchData } = useAppStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculations
  const totalSpent = purchases.reduce((sum, p) => sum + Number(p.valor_total), 0);
  const totalPurchases = purchases.length;
  const totalProducts = products.length;

  // Chart 1: Monthly spent
  const monthlyDataMap: Record<string, number> = {};
  purchases.forEach(p => {
    const date = new Date(p.data);
    const monthYear = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    monthlyDataMap[monthYear] = (monthlyDataMap[monthYear] || 0) + Number(p.valor_total);
  });
  const monthlyChartData = Object.entries(monthlyDataMap).map(([name, valor]) => ({ name, valor })).reverse();

  // Chart 2: Category share
  const categoryDataMap: Record<string, number> = {};
  let totalItemsCount = 0;
  purchases.forEach(p => {
    p.itens?.forEach(item => {
      const catName = item.produto?.categoria_id === 1 ? 'Alimentos' :
                      item.produto?.categoria_id === 2 ? 'Bebidas' :
                      item.produto?.categoria_id === 3 ? 'Limpeza' :
                      item.produto?.categoria_id === 4 ? 'Higiene' :
                      item.produto?.categoria_id === 5 ? 'Açougue' :
                      item.produto?.categoria_id === 6 ? 'Hortifruti' :
                      item.produto?.categoria_id === 7 ? 'Padaria' : 'Outros';

      categoryDataMap[catName] = (categoryDataMap[catName] || 0) + (Number(item.quantidade) * Number(item.valor_unitario));
      totalItemsCount++;
    });
  });
  const categoryChartData = Object.entries(categoryDataMap).map(([name, value]) => ({ name, value }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>Painel Geral</Typography>
        <Typography variant="body2" color="text.secondary">Acompanhe seu consumo e evolução de preços.</Typography>
      </Box>

      {/* Cards Row */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 56, height: 56 }}>
                <TrendingUp size={28} />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Investido</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>R$ {totalSpent.toFixed(2)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.main', width: 56, height: 56 }}>
                <ShoppingBag size={28} />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">Notas Importadas</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{totalPurchases}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.light', color: 'success.main', width: 56, height: 56 }}>
                <ListCollapse size={28} />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">Produtos Padronizados</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{totalProducts}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts section */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: 4, height: 350, p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Evolução de Gastos Mensais</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={monthlyChartData.length > 0 ? monthlyChartData : [{ name: 'Sem dados', valor: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${value}`} />
                <Bar dataKey="valor" fill="#6750A4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 4, height: 350, p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Gastos por Categoria</Typography>
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">Sem dados cadastrados</Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 1 }}>
              {categoryChartData.map((entry, index) => (
                <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[index % COLORS.length] }} />
                  <Typography variant="caption" color="text.secondary">{entry.name}</Typography>
                </Box>
              ))}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Insights Section */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
          <Lightbulb color="#E91E63" size={24} /> Insights Inteligentes
        </Typography>
        <Grid container spacing={2}>
          {insights.length > 0 ? (
            insights.map((insight) => (
              <Grid size={{ xs: 12, sm: 6 }} key={insight.id}>
                <Card sx={{ borderRadius: 3, borderLeft: '5px solid', borderColor: insight.tipo === 'economia' ? 'success.main' : 'primary.main' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 'bold' }}>{insight.titulo}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{insight.descricao}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : (
            <Grid size={12}>
              <Card sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Ainda não geramos nenhum insight. Importe cupons para começar a ver recomendações automáticas.
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
