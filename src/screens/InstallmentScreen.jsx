import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";

const EMPTY_FORM = {
  customer: "",
  productName: "",
  totalAmount: "",
  downPayment: "0",
  totalInstallments: "",
  startDate: new Date().toISOString().slice(0, 10),
  frequency: "monthly",
  notes: "",
};

export default function InstallmentsScreen() {
  const [plans, setPlans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [modalVisible, setModalVisible] = useState(false);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const [plansResponse, customersResponse] = await Promise.all([
        api.get("/installments"),
        api.get("/customers"),
      ]);

      const planList =
        plansResponse.data.installments || plansResponse.data.data || [];
      const responseData = customersResponse.data || {};

      const customerList = Array.isArray(responseData.customers)
        ? responseData.customers
        : Array.isArray(responseData.data)
          ? responseData.data
          : [];

      console.log(
        "Customers from API:",
        customerList.map((customer) => ({
          id: customer._id,
          name: customer.name,
          isActive: customer.isActive,
        })),
      );

      setCustomers(customerList);

      setPlans(Array.isArray(planList) ? planList : []);
      setCustomers(
        Array.isArray(customerList)
          ? customerList.filter((customer) => customer.isActive !== false)
          : [],
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          "Plans load nahi huay. Backend connection check karo.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const selectedCustomer = customers.find(
    (customer) => customer._id === form.customer,
  );

  const totalAmount = Number(form.totalAmount) || 0;
  const downPayment = Number(form.downPayment) || 0;
  const numberOfInstallments = Number(form.totalInstallments) || 0;
  const remainingAmount = totalAmount - downPayment;
  const installmentAmount =
    numberOfInstallments > 0 ? remainingAmount / numberOfInstallments : 0;

  const createPlan = async () => {
    if (!form.customer) {
      Alert.alert("Required", "Pehle customer select karo.");
      return;
    }

    if (!form.productName.trim()) {
      Alert.alert("Required", "Product ya item ka naam enter karo.");
      return;
    }

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0 ||
      !Number.isFinite(downPayment) ||
      downPayment < 0 ||
      downPayment >= totalAmount
    ) {
      Alert.alert(
        "Invalid amount",
        "Total amount positive hona chahiye aur down payment total se kam honi chahiye.",
      );
      return;
    }

    if (!Number.isInteger(numberOfInstallments) || numberOfInstallments < 1) {
      Alert.alert(
        "Invalid installments",
        "Installments ki tadaad 1 ya us se zyada whole number honi chahiye.",
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) {
      Alert.alert("Invalid date", "Date YYYY-MM-DD format mein enter karo.");
      return;
    }

    try {
      setSaving(true);

      const calculatedInstallmentAmount = Number(
        (remainingAmount / numberOfInstallments).toFixed(2),
      );

      const response = await api.post("/installments", {
        customer: form.customer,
        productName: form.productName.trim(),
        totalAmount,
        downPayment,
        installmentAmount: calculatedInstallmentAmount,
        totalInstallments: numberOfInstallments,
        startDate: form.startDate,
        frequency: form.frequency,
        notes: form.notes.trim(),
      });

      const newPlan = response.data.installment || response.data.data;

      setModalVisible(false);
      setForm({ ...EMPTY_FORM });

      await fetchData(true);

      Alert.alert(
        "Success",
        response.data.message || "Installment plan create ho gaya.",
      );

      if (!newPlan) {
        // Refreshed list will show the newly created plan.
      }
    } catch (error) {
      Alert.alert(
        "Unable to create plan",
        error.response?.data?.message ||
          "Installment plan save nahi hua. Backend controller check karo.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredPlans = plans.filter((plan) => {
    const query = search.trim().toLowerCase();
    const customerName =
      typeof plan.customer === "object" ? plan.customer?.name || "" : "";

    return (
      (plan.productName || "").toLowerCase().includes(query) ||
      customerName.toLowerCase().includes(query) ||
      (plan.status || "").toLowerCase().includes(query)
    );
  });

  const renderPlan = ({ item }) => {
    const planTotal = Number(item.totalAmount) || 0;
    const paid = Number(
      item.totalPaid ??
        Number(item.downPayment || 0) + Number(item.paidAmount || 0),
    );

    const balance = Number(
      item.remainingBalance ?? Math.max(planTotal - paid, 0),
    );

    const customerName =
      typeof item.customer === "object"
        ? item.customer?.name || "Customer"
        : "Customer";

    return (
      <View style={styles.planCard}>
        <View style={styles.planTop}>
          <View style={styles.productIcon}>
            <Ionicons name="receipt-outline" size={22} color="#2563EB" />
          </View>

          <View style={styles.planInfo}>
            <Text style={styles.productName}>{item.productName}</Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              item.status === "completed"
                ? styles.completedBadge
                : item.status === "cancelled"
                  ? styles.cancelledBadge
                  : styles.activeBadge,
            ]}
          >
            <Text style={styles.statusText}>{item.status || "active"}</Text>
          </View>
        </View>

        <View style={styles.amountGrid}>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>{planTotal.toLocaleString()}</Text>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Paid</Text>
            <Text style={[styles.amountValue, { color: "#15803D" }]}>
              {paid.toLocaleString()}
            </Text>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Balance</Text>
            <Text style={[styles.amountValue, { color: "#DC2626" }]}>
              {balance.toLocaleString()}
            </Text>
          </View>
        </View>
        {item.overdue && (
          <View style={styles.overdueCard}>
            <View style={styles.overdueHeader}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.overdueTitle}>OVERDUE PAYMENT</Text>
            </View>

            <View style={styles.overdueRow}>
              <Text style={styles.overdueLabel}>Overdue Amount</Text>
              <Text style={styles.overdueAmount}>
                {Number(item.overdueAmount || 0).toLocaleString()}
              </Text>
            </View>

            <View style={styles.overdueRow}>
              <Text style={styles.overdueLabel}>Late Installments</Text>
              <Text style={styles.overdueValue}>
                {item.overdueInstallments || 0}
              </Text>
            </View>
          </View>
        )}

        {item.nextDueDate && item.status === "active" && (
          <View style={styles.nextDueRow}>
            <Ionicons name="calendar-outline" size={16} color="#2563EB" />
            <Text style={styles.nextDueText}>
              Next due: {String(item.nextDueDate).slice(0, 10)}
            </Text>
          </View>
        )}

        {Array.isArray(item.schedule) && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Installment Progress</Text>
              <Text style={styles.progressValue}>
                {item.paidInstallments || 0}/{item.totalInstallments || 0} paid
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      item.totalInstallments
                        ? Math.min(
                            100,
                            ((item.paidInstallments || 0) /
                              item.totalInstallments) *
                              100,
                          )
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.planFooter}>
          <Text style={styles.footerText}>
            {item.totalInstallments || 0} installments ·{" "}
            {item.frequency || "monthly"}
          </Text>
          <Text style={styles.footerText}>
            Start: {item.startDate ? String(item.startDate).slice(0, 10) : "—"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Installment Plans</Text>
          <Text style={styles.subtitle}>{plans.length} plans registered</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (customers.length === 0) {
              Alert.alert(
                "No customers",
                "Plan banane se pehle active customer add karo.",
              );
              return;
            }
            setForm({ ...EMPTY_FORM });
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search product or customer..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 40 }}
          size="large"
          color="#2563EB"
        />
      ) : (
        <FlatList
          data={filteredPlans}
          keyExtractor={(item) => item._id}
          renderItem={renderPlan}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No installment plans</Text>
              <Text style={styles.emptyText}>
                + button se apna pehla plan create karo.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Installment Plan</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={25} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Customer *</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setCustomerPickerVisible(true)}
              >
                <Text
                  style={[
                    styles.selectText,
                    !selectedCustomer && { color: "#94A3B8" },
                  ]}
                >
                  {selectedCustomer
                    ? `${selectedCustomer.name} (${selectedCustomer.phone})`
                    : "Select a customer"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.label}>Product / Item Name *</Text>
              <TextInput
                style={styles.input}
                value={form.productName}
                onChangeText={(value) => updateField("productName", value)}
                placeholder="e.g. Laptop, Mobile, Furniture"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Total Amount *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.totalAmount}
                    onChangeText={(value) => updateField("totalAmount", value)}
                    keyboardType="decimal-pad"
                    placeholder="50000"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.halfField}>
                  <Text style={styles.label}>Down Payment</Text>
                  <TextInput
                    style={styles.input}
                    value={form.downPayment}
                    onChangeText={(value) => updateField("downPayment", value)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.label}>Number of Installments *</Text>
              <TextInput
                style={styles.input}
                value={form.totalInstallments}
                onChangeText={(value) =>
                  updateField("totalInstallments", value)
                }
                keyboardType="number-pad"
                placeholder="e.g. 12"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {["monthly", "weekly"].map((frequency) => (
                  <TouchableOpacity
                    key={frequency}
                    style={[
                      styles.frequencyButton,
                      form.frequency === frequency && styles.frequencySelected,
                    ]}
                    onPress={() => updateField("frequency", frequency)}
                  >
                    <Text
                      style={[
                        styles.frequencyText,
                        form.frequency === frequency &&
                          styles.frequencyTextSelected,
                      ]}
                    >
                      {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>First Due Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                value={form.startDate}
                onChangeText={(value) => updateField("startDate", value)}
                placeholder="2026-11-01"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={form.notes}
                onChangeText={(value) => updateField("notes", value)}
                placeholder="Optional notes"
                placeholderTextColor="#94A3B8"
                multiline
              />

              <View style={styles.calculationCard}>
                <Text style={styles.calculationTitle}>Payment Summary</Text>
                <Text style={styles.calculationText}>
                  Remaining after down payment:{" "}
                  {remainingAmount.toLocaleString()}
                </Text>
                <Text style={styles.calculationText}>
                  Each installment:{" "}
                  {numberOfInstallments > 0
                    ? installmentAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={createPlan}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Create Plan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={customerPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setCustomerPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setCustomerPickerVisible(false)}>
                <Ionicons name="close" size={25} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={customers}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.customerOption}
                  onPress={() => {
                    updateField("customer", item._id);
                    setCustomerPickerVisible(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerOptionName}>{item.name}</Text>
                    <Text style={styles.customerOptionPhone}>{item.phone}</Text>
                  </View>
                  {form.customer === item._id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#2563EB"
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No active customers available.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", paddingTop: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  heading: { fontSize: 25, fontWeight: "800", color: "#0F172A" },
  subtitle: { color: "#64748B", fontSize: 13, marginTop: 5 },
  addButton: {
    backgroundColor: "#2563EB",
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: { flex: 1, height: 48, paddingHorizontal: 10, color: "#0F172A" },
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  planCard: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  planTop: { flexDirection: "row", alignItems: "center" },
  productIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  planInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  customerName: { fontSize: 12, color: "#64748B", marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  activeBadge: { backgroundColor: "#DBEAFE" },
  completedBadge: { backgroundColor: "#DCFCE7" },
  cancelledBadge: { backgroundColor: "#FEE2E2" },
  statusText: { fontSize: 10, fontWeight: "700", color: "#334155" },
  amountGrid: { flexDirection: "row", marginTop: 17, gap: 8 },
  amountBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
  },
  amountLabel: { fontSize: 11, color: "#64748B", marginBottom: 5 },
  amountValue: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  planFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 13,
    paddingTop: 12,
  },
  footerText: { fontSize: 11, color: "#64748B" },
  empty: { alignItems: "center", paddingTop: 65 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 15,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 7,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: 30,
    maxHeight: "94%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    minHeight: 47,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  notesInput: { minHeight: 75, textAlignVertical: "top" },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 13,
    minHeight: 48,
  },
  selectText: { flex: 1, color: "#0F172A", fontSize: 13 },
  row: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1 },
  frequencyRow: { flexDirection: "row", gap: 10 },
  frequencyButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    borderRadius: 11,
    alignItems: "center",
  },
  frequencySelected: { backgroundColor: "#DBEAFE", borderColor: "#2563EB" },
  frequencyText: { color: "#475569", fontWeight: "700" },
  frequencyTextSelected: { color: "#1D4ED8" },
  calculationCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },
  calculationTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1D4ED8",
    marginBottom: 8,
  },
  calculationText: { fontSize: 12, color: "#334155", marginTop: 4 },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  pickerCard: {
    maxHeight: "75%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
  },
  customerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 17, fontWeight: "800", color: "#2563EB" },
  customerOptionName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  customerOptionPhone: { fontSize: 12, color: "#64748B", marginTop: 4 },
  overdueCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },

  overdueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 9,
  },

  overdueTitle: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
  },

  overdueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },

  overdueLabel: {
    color: "#7F1D1D",
    fontSize: 12,
  },

  overdueAmount: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
  },

  overdueValue: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "700",
  },

  nextDueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
  },

  nextDueText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },

  progressContainer: {
    marginTop: 14,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },

  progressLabel: {
    color: "#64748B",
    fontSize: 11,
  },

  progressValue: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },

  progressTrack: {
    height: 7,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#16A34A",
    borderRadius: 10,
  },
});
