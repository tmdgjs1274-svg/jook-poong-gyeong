const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
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
  const { store_tag, store_tag_id } = req.query;
  try {
    // 부가옵션(옵션 그룹/옵션)은 별도 테이블이 아니라 menus.options(jsonb) 컬럼에
    // [{ id, name, is_required, allow_multiple, options: [{ id, name, extra_price }] }] 형태로 저장된다.
    // select('*')에 이미 포함되어 있으므로 별도 join이 필요 없다.
    let query = supabase
      .from('menus')
      .select(`
        *,
        categories (
          id,
          name,
          store_tag
        )
      `);

    // 가게 구분 필터 (문자열 혹은 ID 조건이 들어올 경우 정확히 매칭)
    if (store_tag && store_tag !== '전체') {
      query = query.eq('store_tag', store_tag.trim());
    }
    if (store_tag_id) {
      query = query.eq('store_tag_id', Number(store_tag_id));
    }

    const { data, error } = await query;

    if (error) {
      console.error('메뉴 목록 조회 에러:', error);
      return res.status(500).json({ error: error.message });
    }

    // 선택된 가게와 카테고리의 가게 태그가 일치하는지 한 번 더 검증하여 섞임 방지
    const filteredData = data.filter(menu => {
      if (!store_tag || store_tag === '전체') return true;
      if (menu.store_tag && menu.store_tag.trim() !== store_tag.trim()) return false;
      return true;
    });

    const formattedMenus = filteredData.map(menu => ({
      ...menu,
      category: menu.categories ? menu.categories.name : (menu.category || '카테고리 없음'),
      options: Array.isArray(menu.options) ? menu.options : []
    }));

    res.json(formattedMenus);
  } catch (err) {
    console.error('메뉴 목록 조회 서버 예외:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menus', async (req, res) => {
  const { name, price, store_tag_id, store_tag, category_id, category } = req.body;
  try {
    let categoryName = null;
    let resolvedStoreTag = store_tag ? store_tag.trim() : null;
    const parsedCategoryId = category_id === '' || category_id === null || category_id === undefined ? null : Number(category_id);

    if (parsedCategoryId) {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('name, store_tag')
        .eq('id', parsedCategoryId)
        .single();

      if (!catError && catData) {
        categoryName = catData.name;
        if (catData.store_tag) {
          resolvedStoreTag = catData.store_tag.trim();
        }
      }
    }

    const { data, error } = await supabase
      .from('menus')
      .insert([{
        name,
        price,
        store_tag_id: store_tag_id ? Number(store_tag_id) : null,
        store_tag: resolvedStoreTag,
        category_id: parsedCategoryId,
        category: categoryName || category || null
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, store_tag_id, store_tag, category_id } = req.body;

  try {
    let categoryName = null;
    let resolvedStoreTag = store_tag ? store_tag.trim() : null;
    const parsedCategoryId = category_id === '' || category_id === null || category_id === undefined ? null : Number(category_id);

    if (parsedCategoryId) {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('name, store_tag')
        .eq('id', parsedCategoryId)
        .single();

      if (!catError && catData) {
        categoryName = catData.name;
        if (catData.store_tag) {
          resolvedStoreTag = catData.store_tag.trim();
        }
      }
    }

    const updateData = {
      name,
      price,
      store_tag_id: store_tag_id ? Number(store_tag_id) : null,
      store_tag: resolvedStoreTag,
      category_id: parsedCategoryId,
      category: categoryName
    };

    const { data, error } = await supabase
      .from('menus')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase menus update 에러:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('menus 수정 서버 예외:', err.message);
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
// [1-1] 메뉴 카테고리 관리 API
// ==========================================
app.get('/api/categories', async (req, res) => {
  const { store_tag } = req.query;
  try {
    let query = supabase.from('categories').select('*').order('display_order', { ascending: true });

    if (store_tag && store_tag !== '전체') {
      query = query.eq('store_tag', store_tag.trim());
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase categories 조회 경고:', error.message);
      return res.json([]);
    }
    res.json(data || []);
  } catch (err) {
    console.error('categories API 서버 예외:', err.message);
    res.json([]);
  }
});

app.post('/api/categories', async (req, res) => {
  const { name, store_tag } = req.body;
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, store_tag: store_tag ? store_tag.trim() : null, display_order: 0 }])
      .select();

    if (error) {
      console.error('Supabase categories insert 에러:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('categories 등록 서버 예외:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/order', async (req, res) => {
  try {
    const categories = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.categories || req.body.order);

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const catId = cat.id;
      const displayOrder = cat.display_order !== undefined ? cat.display_order : (cat.sort_order !== undefined ? cat.sort_order : i);

      if (!catId) continue;

      const { error } = await supabase
        .from('categories')
        .update({ display_order: displayOrder })
        .eq('id', catId);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('카테고리 순서 변경 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: catData } = await supabase.from('categories').select('name').eq('id', id).single();
    if (catData) {
      await supabase.from('menus').update({ category: null, category_id: null }).eq('category', catData.name);
    }
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('categories 삭제 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [1-2] 메뉴 부가옵션(옵션 그룹 / 옵션) 관리 API
//  별도 테이블 없이 menus.options(jsonb) 컬럼 하나에 아래 구조로 저장한다.
//  [{ id, name, is_required, allow_multiple, options: [{ id, name, extra_price }] }]
//  예) "옛날칼국수" 메뉴의 options 컬럼에
//      - 옵션 그룹: "곱빼기 선택" (기본/곱빼기)
//      - 옵션 그룹: "면 종류 선택" (칼국수/수제비/칼제비)
// ==========================================
// 메뉴 한 건의 options(jsonb) 배열을 읽어온다.
const getMenuOptions = async (menuId) => {
  const { data, error } = await supabase.from('menus').select('options').eq('id', menuId).single();
  if (error) throw error;
  return Array.isArray(data.options) ? data.options : [];
};

// 옵션 그룹 추가
app.post('/api/menus/:menuId/option-groups', async (req, res) => {
  const { menuId } = req.params;
  const { name, is_required, allow_multiple } = req.body;

  if (!name) return res.status(400).json({ error: '옵션 그룹명을 입력해주세요.' });

  try {
    const currentOptions = await getMenuOptions(menuId);

    const newGroup = {
      id: crypto.randomUUID(),
      name,
      is_required: !!is_required,
      allow_multiple: !!allow_multiple,
      options: []
    };

    const updatedOptions = [...currentOptions, newGroup];

    const { data, error } = await supabase
      .from('menus')
      .update({ options: updatedOptions })
      .eq('id', menuId)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 그룹 추가 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션 그룹 수정 (이름 / 필수 여부 / 다중 선택 허용 여부)
app.put('/api/menus/:menuId/option-groups/:groupId', async (req, res) => {
  const { menuId, groupId } = req.params;
  const { name, is_required, allow_multiple } = req.body;

  try {
    const currentOptions = await getMenuOptions(menuId);
    let found = false;

    const updatedOptions = currentOptions.map(group => {
      if (group.id !== groupId) return group;
      found = true;
      return {
        ...group,
        name: name !== undefined ? name : group.name,
        is_required: is_required !== undefined ? !!is_required : group.is_required,
        allow_multiple: allow_multiple !== undefined ? !!allow_multiple : group.allow_multiple
      };
    });

    if (!found) return res.status(404).json({ error: '옵션 그룹을 찾을 수 없습니다.' });

    const { data, error } = await supabase.from('menus').update({ options: updatedOptions }).eq('id', menuId).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 그룹 수정 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션 그룹 삭제 (하위 옵션도 함께 삭제됨)
app.delete('/api/menus/:menuId/option-groups/:groupId', async (req, res) => {
  const { menuId, groupId } = req.params;
  try {
    const currentOptions = await getMenuOptions(menuId);
    const updatedOptions = currentOptions.filter(group => group.id !== groupId);

    const { error } = await supabase.from('menus').update({ options: updatedOptions }).eq('id', menuId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('옵션 그룹 삭제 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 추가 - 추가 비용 포함
app.post('/api/menus/:menuId/option-groups/:groupId/options', async (req, res) => {
  const { menuId, groupId } = req.params;
  const { name, extra_price } = req.body;

  if (!name) return res.status(400).json({ error: '옵션명을 입력해주세요.' });

  try {
    const currentOptions = await getMenuOptions(menuId);
    let found = false;

    const newOption = {
      id: crypto.randomUUID(),
      name,
      extra_price: extra_price ? Number(extra_price) : 0
    };

    const updatedOptions = currentOptions.map(group => {
      if (group.id !== groupId) return group;
      found = true;
      return { ...group, options: [...(group.options || []), newOption] };
    });

    if (!found) return res.status(404).json({ error: '옵션 그룹을 찾을 수 없습니다.' });

    const { data, error } = await supabase.from('menus').update({ options: updatedOptions }).eq('id', menuId).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 추가 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 수정
app.put('/api/menus/:menuId/option-groups/:groupId/options/:optionId', async (req, res) => {
  const { menuId, groupId, optionId } = req.params;
  const { name, extra_price } = req.body;

  try {
    const currentOptions = await getMenuOptions(menuId);
    let found = false;

    const updatedOptions = currentOptions.map(group => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        options: (group.options || []).map(opt => {
          if (opt.id !== optionId) return opt;
          found = true;
          return {
            ...opt,
            name: name !== undefined ? name : opt.name,
            extra_price: extra_price !== undefined ? Number(extra_price) : opt.extra_price
          };
        })
      };
    });

    if (!found) return res.status(404).json({ error: '옵션을 찾을 수 없습니다.' });

    const { data, error } = await supabase.from('menus').update({ options: updatedOptions }).eq('id', menuId).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 수정 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 삭제
app.delete('/api/menus/:menuId/option-groups/:groupId/options/:optionId', async (req, res) => {
  const { menuId, groupId } = req.params;
  const { optionId } = req.params;

  try {
    const currentOptions = await getMenuOptions(menuId);

    const updatedOptions = currentOptions.map(group => {
      if (group.id !== groupId) return group;
      return { ...group, options: (group.options || []).filter(opt => opt.id !== optionId) };
    });

    const { error } = await supabase.from('menus').update({ options: updatedOptions }).eq('id', menuId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('옵션 삭제 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [2] 가게 구분 관리 API
// ==========================================
app.get('/api/store-tags', async (req, res) => {
  try {
    const { data, error } = await supabase.from('store_tags').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/store-tags', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('store_tags').insert([{ name, display_order: 0 }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/store-tags/order', async (req, res) => {
  try {
    const items = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.store_tags || req.body.order);

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item.id;
      const displayOrder = item.display_order !== undefined ? item.display_order : (item.sort_order !== undefined ? item.sort_order : i);

      if (!itemId) continue;

      const { error } = await supabase
        .from('store_tags')
        .update({ display_order: displayOrder })
        .eq('id', itemId);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('가게 구분 순서 변경 에러:', err.message);
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
    const { data, error } = await supabase.from('order_types').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/order-types', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('order_types').insert([{ name, display_order: 0 }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/order-types/order', async (req, res) => {
  try {
    const items = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.order_types || req.body.order);

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item.id;
      const displayOrder = item.display_order !== undefined ? item.display_order : (item.sort_order !== undefined ? item.sort_order : i);

      if (!itemId) continue;

      const { error } = await supabase
        .from('order_types')
        .update({ display_order: displayOrder })
        .eq('id', itemId);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('배달 구분 순서 변경 에러:', err.message);
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
    const { data: orderTypes } = await supabase.from('order_types').select('id');
    if (orderTypes && orderTypes.length > 0) {
      const exists = orderTypes.some(ot => ot.id === Number(order_type_id));
      if (!exists) order_type_id = orderTypes[0].id;
    }

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
        price: item.price,
        // 선택된 부가옵션 스냅샷. order_items.selected_options 컬럼이 text 타입이므로 JSON 문자열로 저장한다.
        // 예: '[{"group_name":"곱빼기 선택","option_name":"곱빼기","extra_price":1000}]'
        selected_options: JSON.stringify(item.options || [])
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

// 주문 수정 (기존 주문 항목 전체 교체)
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  let { order_type_id, payment_type, total_amount, items, created_at } = req.body;

  try {
    const updateData = {
      order_type_id: Number(order_type_id),
      payment_type: payment_type || '카드',
      total_amount: total_amount
    };
    if (created_at) updateData.created_at = created_at;

    const { error: orderError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id);

    if (orderError) throw orderError;

    // 기존 주문 항목 삭제 후 재등록
    const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', id);
    if (deleteError) throw deleteError;

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: Number(id),
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price,
        selected_options: JSON.stringify(item.options || [])
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
    }

    res.json({ success: true });
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

// order_items.selected_options는 text 컬럼에 JSON 문자열로 저장되어 있으므로 파싱해서 내려준다.
const parseSelectedOptions = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

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

    const formatted = (data || []).map(order => ({
      ...order,
      order_items: (order.order_items || []).map(item => ({
        ...item,
        options: parseSelectedOptions(item.selected_options)
      }))
    }));

    res.json(formatted);
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
