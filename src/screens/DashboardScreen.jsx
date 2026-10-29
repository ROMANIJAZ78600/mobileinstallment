import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";

const formatMoney = (amount = 0) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Local calendar date use karta hai, UTC conversion se date shift nahi hoti.
const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getDateOnly = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  return date;
};

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [dashboardResponse, installmentsResponse] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/installments"),
      ]);

      const dashboardData = dashboardResponse.data || {};
      const installmentData = installmentsResponse.data || {};
      console.log("Dashboard stats:", dashboardResponse.data?.stats);

      console.log(
        "Installment plans:",
        (installmentData.installments || []).map((plan) => ({
          id: plan._id,
          customer:
            typeof plan.customer === "object"
              ? plan.customer?.name
              : plan.customer,
          product: plan.productName,
          status: plan.status,
        })),
      );

      const installmentList = Array.isArray(installmentData.installments)
        ? installmentData.installments
        : Array.isArray(installmentData.data)
          ? installmentData.data
          : [];

      const summary = installmentData.summary || {};
      const oldStats = dashboardData.stats || {};

      // Dashboard summary se overdue plans ka fallback.
      const derivedOverduePlans = installmentList.filter(
        (plan) =>
          plan.status === "active" && Number(plan.overdueAmount || 0) > 0,
      ).length;

      const stats = {
        ...oldStats,
        activePlans: summary.activePlans ?? oldStats.activePlans ?? 0,
        overduePlans: summary.overduePlans ?? derivedOverduePlans,
        overdueAmount:
          summary.totalOverdueAmount ?? oldStats.overdueAmount ?? 0,
        outstandingBalance:
          summary.totalOutstanding ?? oldStats.outstandingBalance ?? 0,
      };

      // Backend upcoming payments ko clean aur sort karo.
      const today = getToday();
      const rawUpcoming = Array.isArray(dashboardData.upcomingPayments)
        ? dashboardData.upcomingPayments
        : [];

      const uniqueUpcoming = new Map();

      for (const item of rawUpcoming) {
        const dueDate = getDateOnly(item.dueDate);
        const amount = Number(item.amount || 0);

        if (!dueDate || dueDate < today || amount <= 0) {
          continue;
        }

        // Har customer ke liye unique key
        const customerKey =
          item.customer?._id ||
          item.customer?.customerId ||
          item.customer?.name ||
          item.customerId;

        if (!customerKey) continue;

        const existing = uniqueUpcoming.get(String(customerKey));

        // Har customer ki sirf sab se qareeb upcoming installment rakho
        if (
          !existing ||
          new Date(item.dueDate).getTime() <
            new Date(existing.dueDate).getTime()
        ) {
          uniqueUpcoming.set(String(customerKey), {
            ...item,
            amount,
          });
        }
      }

      const upcomingPayments = Array.from(uniqueUpcoming.values())
        .sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        )
        .slice(0, 5);

      setData({
        ...dashboardData,
        stats,
        upcomingPayments,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Dashboard load nahi hua. Backend connection check karo.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = data?.stats || {};

  const cards = [
    {
      title: "Total Customers",
      value: stats.totalCustomers ?? 0,
      icon: "people-outline",
      color: "#2563EB",
    },
    {
      title: "Total Plans",
      value: stats.totalPlans ?? 0,
      icon: "document-text-outline",
      color: "#7C3AED",
    },
    {
      title: "Total Collection",
      value: formatMoney(stats.totalCollection),
      icon: "wallet-outline",
      color: "#059669",
    },
    {
      title: "Total Outstanding",
      value: formatMoney(stats.outstandingBalance),
      icon: "hourglass-outline",
      color: "#D97706",
    },
    {
      title: "Overdue Amount",
      value: formatMoney(stats.overdueAmount),
      icon: "alert-circle-outline",
      color: "#DC2626",
    },
    {
      title: "Overdue Plans",
      value: stats.overduePlans ?? 0,
      icon: "calendar-outline",
      color: "#B91C1C",
    },
    {
      title: "Active Plans",
      value: stats.activePlans ?? 0,
      icon: "checkmark-circle-outline",
      color: "#0891B2",
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Dashboard loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchDashboard(true)}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.heading}>Dashboard</Text>
          <Text style={styles.subtitle}>
            Your installment business overview
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons name="grid-outline" size={25} color="#2563EB" />
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retry} onPress={() => fetchDashboard()}>
            Tap to retry
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {cards.map((card) => (
              <View key={card.title} style={styles.card}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: `${card.color}15` },
                  ]}
                >
                  <Ionicons name={card.icon} size={23} color={card.color} />
                </View>

                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text
                  style={styles.cardValue}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {card.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>

            {data?.recentPayments?.length ? (
              data.recentPayments.map((payment, index) => (
                <View
                  key={payment._id || `payment-${index}`}
                  style={styles.paymentRow}
                >
                  <View style={styles.paymentIcon}>
                    <Ionicons name="cash-outline" size={22} color="#059669" />
                  </View>

                  <View style={styles.paymentInfo}>
                    <Text style={styles.customerName}>
                      {payment.installment?.customer?.name || "Customer"}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {payment.installment?.productName ||
                        "Installment payment"}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {formatDate(payment.paymentDate || payment.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.paymentAmount}>
                    {formatMoney(payment.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No payments recorded yet.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Installments</Text>

            {data?.upcomingPayments?.length ? (
              data.upcomingPayments.map((item, index) => (
                <View
                  key={`${item.installmentId}-${item.installmentNumber}`}
                  style={styles.upcomingRow}
                >
                  <View style={styles.numberCircle}>
                    <Text style={styles.numberText}>{index + 1}</Text>
                  </View>

                  <View style={styles.paymentInfo}>
                    <Text style={styles.customerName}>
                      {item.customer?.name || "Customer"}
                    </Text>

                    <Text style={styles.paymentDate}>
                      {item.productName || "Installment"}
                    </Text>

                    <Text style={styles.paymentDate}>
                      Installment #{item.installmentNumber}
                      {" · "}Due {formatDate(item.dueDate)}
                    </Text>

                    {item.frequency ? (
                      <Text style={styles.frequencyText}>
                        {item.frequency === "weekly" ? "Weekly" : "Monthly"}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={styles.paymentAmount}>
                    {formatMoney(item.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No upcoming installments.</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748B",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },
  greeting: {
    fontSize: 14,
    color: "#64748B",
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    minHeight: 145,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 7,
  },
  cardValue: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },
  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  paymentInfo: {
    flex: 1,
    marginRight: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  paymentDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  },
  frequencyText: {
    fontSize: 10,
    color: "#2563EB",
    marginTop: 4,
    textTransform: "capitalize",
  },
  paymentAmount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    paddingBottom: 5,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },
  numberCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  numberText: {
    color: "#2563EB",
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    padding: 16,
    borderRadius: 14,
  },
  errorText: {
    color: "#991B1B",
  },
  retry: {
    color: "#1D4ED8",
    fontWeight: "700",
    marginTop: 10,
  },
});
