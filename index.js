const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('POS Backend Server is Running!');
});

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// [1] 메뉴 관련 API
// ==========================================
app.get('/api/menus', async (req, res) => {
  try {
    const { data, error } = await supabase.from('menus').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menus', async (req, res) => {
  const { name, price, store_tag } = req.body;
  try {
    const { data, error } = await supabase.from('menus').insert([{ name, price, store_tag }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, store_tag } = req.body;
  try {
    const { data, error } = await supabase.from('menus').update({ name, price, store_tag }).eq('id', id).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('menus').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [2] 가게 구분 관리 API
// ==========================================
app.get('/api/store-tags', async (req, res) => {
  try {
    const { data, error } = await supabase.from('store_tags').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/store-tags', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('store_tags').insert([{ name }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 가게 구분 순서 저장 API 추가
app.put('/api/store-tags/order', async (req, res) => {
  try {
    const { items } = req.body; // [{ id, display_order }, ...]
    for (const item of items) {
      await supabase.from('store_tags').update({ display_order: item.display_order }).eq('id', item.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/store-tags/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('store_tags').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [3] 배달 구분 관리 API
// ==========================================
app.get('/api/order-types', async (req, res) => {
  try {
    const { data, error } = await supabase.from('order_types').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/order-types', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('order_types').insert([{ name }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 배달 구분 순서 저장 API 추가
app.put('/api/order-types/order', async (req, res) => {
  try {
    const { items } = req.body; // [{ id, display_order }, ...]
    for (const item of items) {
      await supabase.from('order_types').update({ display_order: item.display_order }).eq('id', item.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/order-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('order_types').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [4] 주문 및 일매출 정산 API
// ==========================================
app.post('/api/orders', async (req, res) => {
  let { store_id, order_type_id, payment_type, total_amount, items, created_at } = req.body;

  try {
    const orderData = {
      order_type_id: Number(order_type_id),
      payment_type: payment_type || '카드',
      total_amount: total_amount
    };

    if (created_at) orderData.created_at = created_at;
    if (store_id) orderData.store_id = store_id;

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) throw orderError;

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
    }

    res.json({ success: true, order_id: newOrder.id });
  } catch (err) {
    console.error('주문 저장 에러:', err);
    res.status(500).json({ error: '주문 저장 중 서버 오류가 발생했습니다.', details: err.message });
  }
});

// 주문 수정 API 추가
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { store_id, order_type_id, payment_type, total_amount, items, created_at } = req.body;

  try {
    const orderData = {
      order_type_id: Number(order_type_id),
      payment_type: payment_type || '카드',
      total_amount: total_amount
    };

    if (created_at) orderData.created_at = created_at;
    if (store_id) orderData.store_id = store_id;

    // 1. 주문 기본 정보 수정
    const { error: updateError } = await supabase
      .from('orders')
      .update(orderData)
      .eq('id', id);

    if (updateError) throw updateError;

    // 2. 기존 주문 아이템 삭제 후 새 아이템으로 재등록
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', id);

    if (deleteError) throw deleteError;

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: id,
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
    }

    res.json({ success: true, message: '주문이 성공적으로 수정되었습니다.' });
  } catch (err) {
    console.error('주문 수정 에러:', err);
    res.status(500).json({ error: '주문 수정 중 서버 오류가 발생했습니다.', details: err.message });
  }
});

app.get('/api/sales/dates', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('created_at').order('created_at', { ascending: false });
    if (error) throw error;
    const dates = [...new Set(data.map(o => o.created_at.split('T')[0]))];
    res.json(dates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sales/daily', async (req, res) => {
  const { date } = req.query;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_types(*), order_items(*, menus(*))`)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [5] 서버 구동 설정
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`POS Backend Server is running on port ${PORT}`);
});