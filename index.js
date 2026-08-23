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

// Supabase 클라이언트 설정 (.env 파일 호환성 강화)
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ .env 파일의 SUPABASE_URL 또는 SUPABASE_ANON_KEY 설정이 누락되었습니다!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// [1] 메뉴 관련 API (조회, 등록, 수정, 삭제)
// ==========================================

// 1-1. 메뉴 목록 조회
app.get('/api/menus', async (req, res) => {
  try {
    const { data, error } = await supabase.from('menus').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('메뉴 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 1-2. 메뉴 등록
app.post('/api/menus', async (req, res) => {
  const { name, price, store_tag_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('menus')
      .insert([{ name, price, store_tag_id }])
      .select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('메뉴 추가 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 1-3. 메뉴 수정
app.put('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, store_tag_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('menus')
      .update({ name, price, store_tag_id })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('메뉴 수정 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 1-4. 메뉴 삭제
app.delete('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('menus').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('메뉴 삭제 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [2] 가게 구분 관리 API (조회, 추가, 삭제)
// ==========================================

// 2-1. 가게 구분 목록 조회
app.get('/api/store-tags', async (req, res) => {
  try {
    const { data, error } = await supabase.from('store_tags').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('가게 구분 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2-2. 가게 구분 추가
app.post('/api/store-tags', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase
      .from('store_tags')
      .insert([{ name }])
      .select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('가게 구분 추가 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2-3. 가게 구분 삭제
app.delete('/api/store-tags/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('store_tags').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('가게 구분 삭제 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [3] 배달 구분 관리 API (조회, 추가, 삭제)
// ==========================================

// 3-1. 배달 구분 목록 조회
app.get('/api/order-types', async (req, res) => {
  try {
    const { data, error } = await supabase.from('order_types').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('배달 구분 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3-2. 배달 구분 추가
app.post('/api/order-types', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase
      .from('order_types')
      .insert([{ name }])
      .select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('배달 구분 추가 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3-3. 배달 구분 삭제
app.delete('/api/order-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('order_types').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('배달 구분 삭제 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [4] 주문 및 일매출 정산 API
// ==========================================

// 4-1. 주문 저장 (안전 변환 로직 포함)
app.post('/api/orders', async (req, res) => {
  console.log('--- /api/orders 요청 들어옴 ---', req.body);
  let { store_id, order_type_id, total_amount, items, created_at } = req.body;

  try {
    // 🔍 order_type_id가 문자열(이름)로 넘어오는 경우 안전하게 ID 숫자로 매핑
    if (order_type_id === '배달의민족' || order_type_id === '배민') order_type_id = 5;
    else if (order_type_id === '쿠팡이즈') order_type_id = 6;
    else if (order_type_id === '매장') order_type_id = 7;
    else {
      order_type_id = Number(order_type_id);
    }

    const orderData = {
      order_type_id: order_type_id,
      total_amount: total_amount
    };

    if (created_at) orderData.created_at = created_at;
    if (store_id) orderData.store_id = store_id;

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      console.error('❌ orders 테이블 저장 에러:', orderError);
      throw orderError;
    }

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        menu_id: item.menu_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('❌ order_items 테이블 저장 에러:', itemsError);
        throw itemsError;
      }
    }

    console.log('✅ 주문 저장 성공! Order ID:', newOrder.id);
    res.json({ success: true, order_id: newOrder.id });

  } catch (err) {
    console.error('❌ [주문 저장 실패 원인]:', err.message || err);
    res.status(500).json({
      error: '주문 저장 중 서버 오류가 발생했습니다.',
      details: err.message || err
    });
  }
});

// 4-2. 일매출 날짜 목록 조회
app.get('/api/sales/dates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const dates = [...new Set(data.map(o => o.created_at.split('T')[0]))];
    res.json(dates);
  } catch (err) {
    console.error('날짜 목록 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4-3. 특정 날짜 주문 내역 상세 조회
app.get('/api/sales/daily', async (req, res) => {
  const { date } = req.query;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_types(*),
        order_items(*, menus(*))
      `)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('일매출 상세 조회 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4-4. 주문 삭제
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('주문 삭제 에러:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [5] 서버 실행
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));