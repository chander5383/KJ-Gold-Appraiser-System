const bcrypt = require('bcryptjs');
const supabase = require('../config/database');
const { generateToken } = require('../middleware/auth');

// ===== LOGIN =====
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Find user
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('is_active', true)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT
    const token = generateToken(user);

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'LOGIN',
      entity_type: 'user',
      entity_id: user.id,
      details: { username: user.username },
      ip_address: req.ip || req.connection.remoteAddress
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

// ===== CHANGE PASSWORD =====
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Get current user
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);

    // Update
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'CHANGE_PASSWORD',
      entity_type: 'user',
      entity_id: userId,
      ip_address: req.ip
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
}

// ===== GET CURRENT USER =====
async function getMe(req, res) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, created_at')
      .eq('id', req.user.id)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: users[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to get user profile.' });
  }
}

module.exports = { login, changePassword, getMe };
