import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const FIELDS = [
  { key: "name", label: "Full Name *", placeholder: "Enter customer name" },
  { key: "phone", label: "Phone Number *", placeholder: "Enter phone number" },
  { key: "email", label: "Email", placeholder: "Enter email address" },
  { key: "address", label: "Address", placeholder: "Enter address" },
  { key: "notes", label: "Notes", placeholder: "Additional notes" },
];

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchCustomers = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const response = await api.get("/customers");
      const list = response.data.customers || response.data.data || [];

      setCustomers(Array.isArray(list) ? list : []);
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          "Customers load nahi ho sake. Backend connection check karo.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingCustomer(null);
    setForm({ ...EMPTY_FORM });
  };

  const saveCustomer = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert("Required", "Customer name aur phone number enter karo.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    };

    try {
      setSaving(true);

      if (editingCustomer) {
        const response = await api.put(
          `/customers/${editingCustomer._id}`,
          payload,
        );

        const updatedCustomer = response.data.customer || response.data.data;

        if (updatedCustomer?._id) {
          setCustomers((previous) =>
            previous.map((customer) =>
              customer._id === updatedCustomer._id ? updatedCustomer : customer,
            ),
          );
        } else {
          await fetchCustomers(true);
        }

        Alert.alert("Success", "Customer successfully update ho gaya.");
      } else {
        const response = await api.post("/customers", payload);
        const newCustomer = response.data.customer || response.data.data;

        if (newCustomer?._id) {
          setCustomers((previous) => [
            newCustomer,
            ...previous.filter((item) => item._id !== newCustomer._id),
          ]);
        } else {
          await fetchCustomers(true);
        }

        Alert.alert("Success", "Customer successfully add ho gaya.");
      }

      setModalVisible(false);
      setEditingCustomer(null);
      setForm({ ...EMPTY_FORM });
    } catch (error) {
      Alert.alert(
        editingCustomer ? "Unable to update" : "Unable to add customer",
        error.response?.data?.message ||
          "Customer save nahi hua. Dobara try karo.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivateCustomer = (customer) => {
    Alert.alert(
      "Deactivate Customer",
      `Kya aap "${customer.name}" ko deactivate karna chahte hain?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/customers/${customer._id}`);

              setCustomers((previous) =>
                previous.map((item) =>
                  item._id === customer._id
                    ? { ...item, isActive: false }
                    : item,
                ),
              );

              Alert.alert("Success", "Customer deactivate ho gaya.");
            } catch (error) {
              Alert.alert(
                "Error",
                error.response?.data?.message ||
                  "Customer deactivate nahi ho saka.",
              );
            }
          },
        },
      ],
    );
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!showInactive && customer.isActive === false) return false;

    const query = search.trim().toLowerCase();

    return (
      (customer.name || "").toLowerCase().includes(query) ||
      (customer.phone || "").toLowerCase().includes(query) ||
      (customer.customerId || "").toLowerCase().includes(query)
    );
  });

  const renderCustomer = ({ item }) => (
    <View style={styles.customerCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.name || "?").charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name}</Text>

        <Text style={styles.phone}>
          <Ionicons name="call-outline" size={13} color="#64748B" />{" "}
          {item.phone}
        </Text>

        {!!item.customerId && (
          <Text style={styles.customerId}>ID: {item.customerId}</Text>
        )}

        {!!item.email && <Text style={styles.detail}>{item.email}</Text>}
        {!!item.address && <Text style={styles.detail}>{item.address}</Text>}

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: item.isActive === false ? "#FEE2E2" : "#DCFCE7",
              alignSelf: "flex-start",
            },
          ]}
        >
          <Text
            style={{
              color: item.isActive === false ? "#991B1B" : "#166534",
              fontSize: 10,
              fontWeight: "700",
            }}
          >
            {item.isActive === false ? "Inactive" : "Active"}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="create-outline" size={16} color="#1D4ED8" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          {item.isActive !== false && (
            <TouchableOpacity
              style={styles.deactivateButton}
              onPress={() => deactivateCustomer(item)}
            >
              <Ionicons
                name="person-remove-outline"
                size={16}
                color="#B91C1C"
              />
              <Text style={styles.deactivateButtonText}>Deactivate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Customers</Text>
          <Text style={styles.subtitle}>
            {customers.filter((c) => c.isActive !== false).length} active ·{" "}
            {customers.length} total
          </Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone or ID..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowInactive((previous) => !previous)}
      >
        <Ionicons
          name={showInactive ? "eye-off-outline" : "eye-outline"}
          size={17}
          color="#2563EB"
        />
        <Text style={styles.filterText}>
          {showInactive ? "Hide inactive customers" : "Show inactive customers"}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 40 }}
          size="large"
          color="#2563EB"
        />
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item._id}
          renderItem={renderCustomer}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCustomers(true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No customers found</Text>
              <Text style={styles.emptyText}>
                Search change karo ya + button se customer add karo.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? "Edit Customer" : "Add Customer"}
              </Text>

              <TouchableOpacity onPress={closeModal} disabled={saving}>
                <Ionicons name="close" size={25} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {FIELDS.map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={[
                      styles.input,
                      (field.key === "notes" || field.key === "address") &&
                        styles.multilineInput,
                    ]}
                    placeholder={field.placeholder}
                    placeholderTextColor="#94A3B8"
                    value={form[field.key]}
                    onChangeText={(value) => updateField(field.key, value)}
                    keyboardType={
                      field.key === "phone"
                        ? "phone-pad"
                        : field.key === "email"
                          ? "email-address"
                          : "default"
                    }
                    autoCapitalize={field.key === "email" ? "none" : "words"}
                    multiline={field.key === "notes" || field.key === "address"}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={saveCustomer}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingCustomer ? "Update Customer" : "Save Customer"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    marginBottom: 20,
  },
  heading: { fontSize: 27, fontWeight: "800", color: "#0F172A" },
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
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: { flex: 1, height: 48, paddingHorizontal: 10, color: "#0F172A" },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 22,
    paddingVertical: 9,
    marginBottom: 8,
    gap: 7,
  },
  filterText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  customerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#2563EB", fontSize: 19, fontWeight: "800" },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 5,
  },
  phone: { fontSize: 12, color: "#475569" },
  customerId: { fontSize: 11, color: "#2563EB", marginTop: 5 },
  detail: { fontSize: 12, color: "#64748B", marginTop: 5 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 9,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  editButtonText: { color: "#1D4ED8", fontWeight: "700", fontSize: 12 },
  deactivateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  deactivateButtonText: { color: "#B91C1C", fontWeight: "700", fontSize: 12 },
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
    padding: 22,
    paddingBottom: 30,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  modalTitle: { fontSize: 21, fontWeight: "800", color: "#0F172A" },
  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
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
  },
  multilineInput: { minHeight: 75, textAlignVertical: "top" },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
