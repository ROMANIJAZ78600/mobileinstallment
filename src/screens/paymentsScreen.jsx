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

const METHODS = ["cash", "bank", "online", "other"];

const getLocalDate = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const EMPTY_FORM = {
  installment: "",
  amount: "",
  paymentDate: getLocalDate(),
  method: "cash",
  receiptNumber: "",
  notes: "",
};

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const money = (value) =>
  (Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export default function PaymentsScreen() {
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [planPickerVisible, setPlanPickerVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [historySummary, setHistorySummary] = useState(null);

  const fetchPlans = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get("/installments");

      const list = response.data.installments || response.data.data || [];

      setPlans(Array.isArray(list) ? list : []);
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Installment plans load nahi huay.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const updateField = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const getCustomerName = (plan) => {
    if (plan?.customer && typeof plan.customer === "object") {
      return plan.customer.name || "Customer";
    }

    return "Customer";
  };

  const getBalance = (plan) => {
    if (!plan) return 0;

    if (plan.remainingBalance !== undefined && plan.remainingBalance !== null) {
      return Math.max(Number(plan.remainingBalance) || 0, 0);
    }

    const total = Number(plan.totalAmount) || 0;
    const downPayment = Number(plan.downPayment) || 0;

    // Fallback assumes totalPaid excludes the down payment.
    const installmentPayments = Number(
      plan.installmentPayments ?? plan.totalPaid ?? plan.paidAmount ?? 0,
    );

    return Math.max(
      Number((total - downPayment - installmentPayments).toFixed(2)),
      0,
    );
  };

  const openPaymentModal = (plan = null) => {
    setForm({
      ...EMPTY_FORM,
      paymentDate: getLocalDate(),
      installment: plan?._id || "",
    });

    setSelectedPlan(plan);
    setModalVisible(true);
  };

  const choosePlan = (plan) => {
    setSelectedPlan(plan);

    setForm((previous) => ({
      ...previous,
      installment: plan._id,
    }));

    setPlanPickerVisible(false);
  };

  const loadPaymentHistory = async (plan) => {
    setSelectedPlan(plan);
    setPayments([]);
    setHistorySummary(null);
    setHistoryLoading(true);

    try {
      const response = await api.get(`/payments/${plan._id}`);

      const list = response.data.payments || response.data.data || [];

      setPayments(Array.isArray(list) ? list : []);
      setHistorySummary(response.data.summary || null);
    } catch (error) {
      Alert.alert(
        "History Error",
        error.response?.data?.message || "Payment history load nahi ho saki.",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setSelectedPlan(null);
    setPayments([]);
    setHistorySummary(null);
  };

  const recordPayment = async () => {
    if (!form.installment) {
      Alert.alert("Required", "Installment plan select karo.");
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        "Invalid amount",
        "Payment amount zero se zyada hona chahiye.",
      );
      return;
    }

    if (!isValidDate(form.paymentDate)) {
      Alert.alert(
        "Invalid date",
        "Valid date YYYY-MM-DD format mein enter karo.",
      );
      return;
    }

    const plan = plans.find((item) => item._id === form.installment);

    if (!plan) {
      Alert.alert(
        "Plan not found",
        "Selected installment plan dobara select karo.",
      );
      return;
    }

    const balance = getBalance(plan);

    if (amount > balance + 0.001) {
      Alert.alert(
        "Amount exceeds balance",
        `Is plan ka remaining balance ${money(balance)} hai.`,
      );
      return;
    }

    try {
      setSaving(true);

      const response = await api.post("/payments", {
        installment: form.installment,
        amount,
        paymentDate: form.paymentDate,
        method: form.method,
        receiptNumber: form.receiptNumber.trim(),
        notes: form.notes.trim(),
      });

      setModalVisible(false);
      setPlanPickerVisible(false);

      // Refresh plans so their balances and statuses are up to date.
      await fetchPlans(true);

      Alert.alert(
        "Payment Recorded",
        response.data.message || "Payment successfully record ho gayi.",
      );

      // Reload history for the plan that was paid.
      await loadPaymentHistory(plan);
    } catch (error) {
      Alert.alert(
        "Payment Failed",
        error.response?.data?.message ||
          "Payment record nahi hui. Backend response check karo.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredPlans = plans.filter((plan) => {
    const query = search.trim().toLowerCase();

    return (
      (plan.productName || "").toLowerCase().includes(query) ||
      getCustomerName(plan).toLowerCase().includes(query) ||
      (plan.status || "").toLowerCase().includes(query)
    );
  });

  const renderPlan = ({ item }) => {
    const balance = getBalance(item);
    const canPay =
      item.status !== "completed" && item.status !== "cancelled" && balance > 0;

    return (
      <View style={styles.planCard}>
        <View style={styles.planRow}>
          <View style={styles.planIcon}>
            <Ionicons name="receipt-outline" size={22} color="#2563EB" />
          </View>

          <View style={styles.planInfo}>
            <Text style={styles.planName}>
              {item.productName || "Installment Plan"}
            </Text>

            <Text style={styles.planCustomer}>{getCustomerName(item)}</Text>

            <Text style={styles.planMeta}>
              Total amount: {money(item.totalAmount)}
            </Text>

            <View
              style={[
                styles.statusBadge,
                item.status === "completed" && styles.completedBadge,
                item.status === "cancelled" && styles.cancelledBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  item.status === "completed" && styles.completedText,
                  item.status === "cancelled" && styles.cancelledText,
                ]}
              >
                {item.status || "active"}
              </Text>
            </View>
          </View>

          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>BALANCE</Text>
            <Text style={styles.balanceValue}>{money(balance)}</Text>
          </View>
        </View>

        <View style={styles.planActions}>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => loadPaymentHistory(item)}
          >
            <Ionicons name="time-outline" size={17} color="#1D4ED8" />
            <Text style={styles.historyButtonText}>History</Text>
          </TouchableOpacity>

          {canPay && (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => openPaymentModal(item)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.payButtonText}>Record Payment</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPayment = ({ item }) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentIcon}>
        <Ionicons name="checkmark-circle-outline" size={23} color="#15803D" />
      </View>

      <View style={styles.paymentInfo}>
        <Text style={styles.paymentAmount}>{money(item.amount)}</Text>

        <Text style={styles.paymentMeta}>
          {(item.method || "other").toUpperCase()} ·{" "}
          {item.paymentDate
            ? String(item.paymentDate).slice(0, 10)
            : "Date unavailable"}
        </Text>

        {!!item.receiptNumber && (
          <Text style={styles.paymentMeta}>Receipt: {item.receiptNumber}</Text>
        )}

        {!!item.notes && <Text style={styles.paymentMeta}>{item.notes}</Text>}
      </View>
    </View>
  );

  const renderHistory = () => {
    if (!selectedPlan) return null;

    return (
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <View style={styles.historyHeadingContainer}>
            <Text style={styles.historyTitle}>Payment History</Text>

            <Text style={styles.historySubtitle}>
              {selectedPlan.productName || "Installment Plan"} ·{" "}
              {getCustomerName(selectedPlan)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={closeHistory}
            style={styles.closeHistoryButton}
          >
            <Ionicons name="close-circle" size={25} color="#64748B" />
          </TouchableOpacity>
        </View>

        {historyLoading ? (
          <ActivityIndicator
            style={{ marginVertical: 25 }}
            size="large"
            color="#2563EB"
          />
        ) : (
          <>
            {historySummary && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Payment Overview</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Down Payment</Text>
                  <Text style={styles.summaryValue}>
                    {money(historySummary.downPayment)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Installment Payments</Text>
                  <Text style={styles.summaryValue}>
                    {money(historySummary.installmentPayments)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Paid</Text>
                  <Text style={styles.totalPaid}>
                    {money(historySummary.totalPaid)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Remaining Balance</Text>
                  <Text style={styles.remainingValue}>
                    {money(historySummary.remainingBalance)}
                  </Text>
                </View>

                <Text style={styles.paymentCount}>
                  {historySummary.paymentCount || 0} payments recorded
                </Text>
              </View>
            )}

            <Text style={styles.transactionsTitle}>Transactions</Text>

            {payments.length > 0 ? (
              payments.map((payment, index) => (
                <View key={payment._id || String(index)}>
                  {renderPayment({ item: payment })}
                </View>
              ))
            ) : (
              <View style={styles.historyEmpty}>
                <Ionicons name="receipt-outline" size={35} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No payments yet</Text>
                <Text style={styles.emptyText}>
                  Is plan ki payment history abhi available nahi hai.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.heading}>Payments</Text>
          <Text style={styles.subtitle}>
            Manage collections and payment history
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => openPaymentModal()}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={25} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search product or customer..."
          placeholderTextColor="#94A3B8"
          returnKeyType="search"
        />

        {!!search && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={19} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {!loading && (
        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Installment Plans</Text>
          <Text style={styles.planCount}>{filteredPlans.length} plans</Text>
        </View>
      )}

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
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPlans(true)}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="card-outline" size={34} color="#64748B" />
              </View>

              <Text style={styles.emptyTitle}>No plans found</Text>

              <Text style={styles.emptyText}>
                {search
                  ? "Search change karke dobara try karo."
                  : "Pehle installment plan create karo."}
              </Text>
            </View>
          }
          ListFooterComponent={renderHistory}
        />
      )}

      {/* Record Payment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <Text style={styles.modalSubtitle}>
                  Enter collection details
                </Text>
              </View>

              <TouchableOpacity
                disabled={saving}
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>Installment Plan *</Text>

              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setPlanPickerVisible(true)}
              >
                <Text
                  style={[
                    styles.selectText,
                    !selectedPlan && styles.placeholderText,
                  ]}
                  numberOfLines={2}
                >
                  {selectedPlan
                    ? `${selectedPlan.productName || "Plan"} — ${getCustomerName(selectedPlan)}`
                    : "Select installment plan"}
                </Text>

                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>

              {selectedPlan && (
                <View style={styles.modalBalanceCard}>
                  <Text style={styles.modalBalanceLabel}>
                    Remaining Balance
                  </Text>
                  <Text style={styles.modalBalanceValue}>
                    {money(getBalance(selectedPlan))}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Payment Amount *</Text>

              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(value) => updateField("amount", value)}
                keyboardType="decimal-pad"
                placeholder="Enter amount"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Payment Date (YYYY-MM-DD)</Text>

              <TextInput
                style={styles.input}
                value={form.paymentDate}
                onChangeText={(value) => updateField("paymentDate", value)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Payment Method</Text>

              <View style={styles.methodRow}>
                {METHODS.map((method) => {
                  const active = form.method === method;

                  return (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.methodButton,
                        active && styles.methodSelected,
                      ]}
                      onPress={() => updateField("method", method)}
                    >
                      <Text
                        style={[
                          styles.methodText,
                          active && styles.methodTextSelected,
                        ]}
                      >
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Receipt Number</Text>

              <TextInput
                style={styles.input}
                value={form.receiptNumber}
                onChangeText={(value) => updateField("receiptNumber", value)}
                placeholder="Optional receipt number"
                placeholderTextColor="#94A3B8"
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

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={recordPayment}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.saveButtonText}>Save Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Plan Picker Modal */}
      <Modal
        visible={planPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPlanPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Plan</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a plan to record payment
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setPlanPickerVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={plans.filter(
                (plan) =>
                  plan.status !== "completed" &&
                  plan.status !== "cancelled" &&
                  getBalance(plan) > 0,
              )}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.planOption}
                  onPress={() => choosePlan(item)}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={19}
                      color="#2563EB"
                    />
                  </View>

                  <View style={styles.optionInfo}>
                    <Text style={styles.planName}>
                      {item.productName || "Installment Plan"}
                    </Text>
                    <Text style={styles.planCustomer}>
                      {getCustomerName(item)}
                    </Text>
                    <Text style={styles.optionBalance}>
                      Balance: {money(getBalance(item))}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Ionicons
                    name="checkmark-done-circle-outline"
                    size={36}
                    color="#94A3B8"
                  />
                  <Text style={styles.emptyText}>
                    Koi payable installment plan available nahi hai.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: 18,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 18,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  heading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.6,
  },

  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  searchInput: {
    flex: 1,
    height: 49,
    paddingHorizontal: 10,
    color: "#0F172A",
    fontSize: 13,
  },

  listHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
  },

  listTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  planCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 35,
    flexGrow: 1,
  },

  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
    shadowColor: "#0F172A",
    shadowOpacity: 0.035,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  planRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  planInfo: {
    flex: 1,
    paddingRight: 7,
  },

  planName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },

  planCustomer: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  planMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 7,
  },

  statusBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#166534",
    textTransform: "capitalize",
  },

  completedBadge: {
    backgroundColor: "#DBEAFE",
  },

  completedText: {
    color: "#1D4ED8",
  },

  cancelledBadge: {
    backgroundColor: "#FEE2E2",
  },

  cancelledText: {
    color: "#B91C1C",
  },

  balanceBox: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "flex-end",
    maxWidth: 112,
  },

  balanceLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#991B1B",
    letterSpacing: 0.5,
  },

  balanceValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B91C1C",
    marginTop: 5,
  },

  planActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexWrap: "wrap",
  },

  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#DBEAFE",
  },

  historyButtonText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },

  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    flex: 1,
  },

  payButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  historySection: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 20,
    marginTop: 7,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  historyHeadingContainer: {
    flex: 1,
    paddingRight: 8,
  },

  historyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },

  historySubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  closeHistoryButton: {
    padding: 3,
  },

  summaryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 15,
    padding: 15,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 7,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },

  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    textAlign: "right",
  },

  totalPaid: {
    fontSize: 14,
    fontWeight: "800",
    color: "#15803D",
    textAlign: "right",
  },

  remainingValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B91C1C",
    textAlign: "right",
  },

  paymentCount: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 12,
  },

  transactionsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },

  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 13,
    padding: 12,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  paymentIcon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  paymentInfo: {
    flex: 1,
  },

  paymentAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#15803D",
  },

  paymentMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 5,
  },

  historyEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 10,
  },

  empty: {
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    marginTop: 14,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 7,
    textAlign: "center",
    lineHeight: 19,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.48)",
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
    maxHeight: "94%",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
  },

  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 13,
    marginBottom: 7,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    minHeight: 48,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    fontSize: 13,
  },

  notesInput: {
    minHeight: 78,
    textAlignVertical: "top",
  },

  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 13,
    minHeight: 49,
    gap: 10,
  },

  selectText: {
    flex: 1,
    fontSize: 12,
    color: "#0F172A",
  },

  placeholderText: {
    color: "#94A3B8",
  },

  modalBalanceCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 13,
    marginTop: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalBalanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1D4ED8",
  },

  modalBalanceValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1D4ED8",
  },

  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  methodButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  methodSelected: {
    backgroundColor: "#DBEAFE",
    borderColor: "#2563EB",
  },

  methodText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 12,
  },

  methodTextSelected: {
    color: "#1D4ED8",
    fontWeight: "800",
  },

  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 13,
    marginTop: 22,
    marginBottom: 10,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15,23,42,0.48)",
  },

  pickerCard: {
    maxHeight: "78%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
  },

  planOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 11,
  },

  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  optionInfo: {
    flex: 1,
  },

  optionBalance: {
    fontSize: 11,
    color: "#1D4ED8",
    fontWeight: "700",
    marginTop: 5,
  },

  pickerEmpty: {
    alignItems: "center",
    paddingVertical: 25,
    gap: 8,
  },
});
