const bcrypt = require('bcryptjs');
const supabase = require('../config/database');

// ===== LIST USERS =====
async function getUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ users: data || [] });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
}

// ===== CREATE USER =====
async function createUser(req, res) {
  try {
    const { username, password, full_name, role = 'user' } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full name are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert({
        username: username.toLowerCase().trim(),
        password_hash: hash,
        full_name,
        role
      })
      .select('id, username, full_name, role, is_active, created_at')
      .single();

    if (error) throw error;

    // Log
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'CREATE_USER',
      entity_type: 'user',
      entity_id: data.id,
      details: { username: data.username },
      ip_address: req.ip
    });

    res.status(201).json({ user: data });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
}

// ===== UPDATE USER =====
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { full_name, role, is_active } = req.body;

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, username, full_name, role, is_active')
      .single();

    if (error) throw error;

    res.json({ user: data });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
}

// ===== RESET PASSWORD =====
async function resetPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);

    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', id);

    if (error) throw error;

    // Log
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'RESET_PASSWORD',
      entity_type: 'user',
      entity_id: id,
      ip_address: req.ip
    });

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
}

// ===== GET ACTIVITY LOGS =====
async function getActivityLogs(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error, count } = await supabase
      .from('activity_logs')
      .select(`
        *,
        users:user_id (username, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      logs: data || [],
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count || 0) / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get activity logs error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
}

module.exports = { getUsers, createUser, updateUser, resetPassword, getActivityLogs };
