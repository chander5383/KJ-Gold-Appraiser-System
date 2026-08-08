const supabase = require('../config/database');

// ===== GET DASHBOARD STATS =====
async function getStats(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = `${today.substring(0, 7)}-01`;

    // Today's certificates
    const { count: todayCerts } = await supabase
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('cert_date', today);

    // Total certificates
    const { count: totalCerts } = await supabase
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    // Today's total gold value
    const { data: todayValueData } = await supabase
      .from('certificates')
      .select('grand_total')
      .eq('is_deleted', false)
      .eq('cert_date', today);

    const todayGoldValue = (todayValueData || []).reduce(
      (sum, c) => sum + (parseFloat(c.grand_total) || 0), 0
    );

    // Monthly certificates
    const { count: monthlyCerts } = await supabase
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .gte('cert_date', firstOfMonth)
      .lte('cert_date', today);

    // Recent activity (last 10)
    const { data: recentActivity } = await supabase
      .from('activity_logs')
      .select(`
        *,
        users:user_id (username, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Recent certificates (last 5)
    const { data: recentCerts } = await supabase
      .from('certificates')
      .select('id, cert_no, borrower_name, grand_total, cert_date, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      stats: {
        todayCertificates: todayCerts || 0,
        totalCertificates: totalCerts || 0,
        todayGoldValue: todayGoldValue,
        monthlyCertificates: monthlyCerts || 0
      },
      recentActivity: recentActivity || [],
      recentCertificates: recentCerts || []
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
}

module.exports = { getStats };
