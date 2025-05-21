import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { Trash2, PlusCircle } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { supabase } from '@/services/supabaseClient';
import { useIsFocused } from '@react-navigation/native';
import { PieChart as GiftedPieChart } from 'react-native-gifted-charts';

export default function HaulScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');
  const successColor = useThemeColor('success');
  const btnBorderColor = useThemeColor('tint');
  const [loading, setLoading] = useState(true);
  const [haul, setHaul] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const isFocused = typeof useIsFocused === 'function' ? useIsFocused() : true;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  useEffect(() => {
    const fetchHaul = async () => {
      if (!userId) return;
      setLoading(true);
      // Get open haul
      const { data: hauls, error: haulError } = await supabase
        .from('hauls')
        .select('*')
        .eq('user_id', userId)
        .eq('finished', false)
        .order('created_at', { ascending: false })
        .limit(1);
      if (haulError) {
        setLoading(false);
        return;
      }
      const openHaul = hauls && hauls[0];
      setHaul(openHaul);
      if (openHaul) {
        // Get items for this haul
        const { data: haulItems, error: itemsError } = await supabase
          .from('haul_items')
          .select('*')
          .eq('haul_id', openHaul.id)
          .order('added_at', { ascending: false });
        setItems(haulItems || []);
      } else {
        setItems([]);
      }
      setLoading(false);
    };
    if (userId && isFocused) fetchHaul();
  }, [userId, isFocused]);

  // Calculate summary
  const totalSpent = items.reduce((sum, i) => sum + (Number(i.purchase_price) || 0), 0);
  const totalExpected = items.reduce((sum, i) => sum + (Number(i.sale_price) || 0), 0);
  const totalProfit = totalExpected - totalSpent;
  const avgMargin = items.length > 0 ? items.reduce((sum, i) => sum + ((Number(i.sale_price) || 0) - (Number(i.purchase_price) || 0)), 0) / items.length : 0;

  // Prepare data for react-native-gifted-charts PieChart
  const giftedPieChartData = [
    {
      value: Number(totalSpent.toFixed(2)),
      color: errorColor,
      text: `Spent\n$${totalSpent.toFixed(2)}`,
    },
    {
      value: Number(totalExpected.toFixed(2)),
      color: successColor,
      text: `Revenue\n$${totalExpected.toFixed(2)}`,
    },
  ];

  const handleFinishHaul = async () => {
    if (!haul) return;
    Alert.alert('Finish Haul', 'Are you sure you want to lock this haul? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: async () => {
        await supabase.from('hauls').update({ finished: true, finished_at: new Date().toISOString() }).eq('id', haul.id);
        setHaul(null);
        setItems([]);
      } }
    ]);
  };

  const handleStartNewHaul = async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('hauls').insert({ user_id: userId, name: `Haul ${new Date().toLocaleDateString()}` }).select();
    if (data && data[0]) {
      setHaul(data[0]);
      setItems([]);
    }
  };

  // Delete item from haul
  const handleDeleteItem = async (itemId: string) => {
    Alert.alert('Delete Item', 'Are you sure you want to remove this item from your haul?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('haul_items').delete().eq('id', itemId);
        setItems(items => items.filter(i => i.id !== itemId));
      } }
    ]);
  };

  // List header for summary and graphs
  const renderHeader = () => (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: textColor, fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>{haul.name || 'Current Haul'}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2, fontWeight: 'bold' }}>Overview:</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Total Items: {items.length}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Total Spent: ${totalSpent.toFixed(2)}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Expected Sales: ${totalExpected.toFixed(2)}</Text>
          <Text style={{ color: successColor, fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>Expected Profit: ${totalProfit.toFixed(2)}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 8 }}>Average Margin: {avgMargin.toFixed(2)}</Text>
        </View>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <View>
            {(totalSpent > 0 || totalExpected > 0) ? (
              <GiftedPieChart
                data={giftedPieChartData}
                donut
                textColor={textColor}
                textSize={14}
                radius={80}
                innerRadius={50}
                innerCircleColor={backgroundColor}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>Profit</Text>
                    <Text style={{ color: textColor, fontSize: 14 }}>${totalProfit.toFixed(2)}</Text>
                  </View>
                )}
                strokeColor={backgroundColor}
                strokeWidth={1}
                showValuesAsLabels={false}
                showGradient={false}
              />
            ) : (
              <Text style={{ color: textColor, fontSize: 12, textAlign: 'center', marginTop: 8 }}>No data to display.</Text>
            )}
          </View>
        </View>
      </View>
      <TouchableOpacity style={{ marginTop: 8, backgroundColor: backgroundColor, borderColor: btnBorderColor, borderWidth: 1, borderRadius: 8, padding: 16, alignItems: 'center' }} onPress={handleFinishHaul}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Finish Haul</Text>
      </TouchableOpacity>
      <View style={{ marginTop: 16, marginBottom: 8 }}>
        <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Items in Haul</Text>
      </View>
    </View>
  );

  if (loading) {
    return <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}><ActivityIndicator size="large" color={tintColor} /></SafeAreaView>;
  }

  if (!haul) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}> 
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor, fontSize: 20, marginBottom: 16 }}>No open haul</Text>
          <TouchableOpacity style={{ backgroundColor: tintColor, borderRadius: 8, padding: 16 }} onPress={handleStartNewHaul}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Start New Haul</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}> 
      {items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor, fontSize: 18, marginTop: 32 }}>No items in this haul yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => {
            const margin = (Number(item.sale_price) || 0) - (Number(item.purchase_price) || 0);
            return (
              <Animated.View entering={FadeInDown.duration(400)} layout={Layout.springify()} style={[styles.itemCard, { backgroundColor: cardColor, shadowColor: cardColor, marginBottom: 16 }]}> 
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.itemImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: cardColor }]}> 
                      <PlusCircle size={32} color={tintColor} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>{item.title}</Text>
                    <Text style={{ color: textColor, fontSize: 14 }}>Expected Sale: ${Number(item.sale_price).toFixed(2)}</Text>
                    <Text style={{ color: textColor, fontSize: 14 }}>Purchase Price: ${Number(item.purchase_price).toFixed(2)}</Text>
                    <Text style={{ color: margin >= 0 ? tintColor : errorColor, fontWeight: 'bold', fontSize: 14 }}>Margin: ${margin.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ marginLeft: 8, padding: 8 }}>
                    <Trash2 size={22} color={errorColor} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  itemCard: { borderRadius: 12, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  itemImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
});