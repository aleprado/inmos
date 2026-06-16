import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { signOut, updatePassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Check, Edit3, Trash2, Home, Compass, Maximize2, X, MessageSquare, Search, Archive, Star, LogOut, Users, UserPlus, Phone, Mail, ShieldCheck, Download, Video, FileText, Printer, Eye, Settings, Save, Key } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import PropertyEditModal from './PropertyEditModal';
import PropertyFlyer from './PropertyFlyer';
import SignageFlyer from './SignageFlyer';
import AIChatAssistant from './AIChatAssistant';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { useToast } from '../contexts/ToastContext';

export default function PropertyReviewDashboard({ tenantId, tenantData, userClaims, currentUser }) {
  const toast = useToast();
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operatorsLoading, setOperatorsLoading] = useState(true);

  // Temporizador de inactividad (para Operadores)
  useInactivityTimer({
    isEnabled: true,
    timeoutMs: 30 * 60 * 1000, // 30 minutos de inactividad
    onIdle: () => {
      alert("Tu sesión ha caducado por inactividad. Por favor, vuelve a iniciar sesión.");
      signOut(auth).catch(console.error);
    }
  });
  
  // Pestañas del Panel: 'pending' | 'approved' | 'archived' | 'operators' | 'settings'
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para la configuración del tenant
  const [tenantSettings, setTenantSettings] = useState({
    name: tenantData?.name || '',
    whatsappNumber: tenantData?.whatsappNumber || '',
    primaryColor: tenantData?.primaryColor || '#0b57d0',
    themeMode: tenantData?.themeMode || 'light',
    backgroundColor: tenantData?.backgroundColor || '#f8fafc',
    catalogLayout: tenantData?.catalogLayout || 'mixed',
    logoUrl: tenantData?.logoUrl || ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (tenantData) {
      setTenantSettings({
        name: tenantData.name || '',
        whatsappNumber: tenantData.whatsappNumber || '',
        primaryColor: tenantData.primaryColor || '#0b57d0',
        themeMode: tenantData.themeMode || 'light',
        backgroundColor: tenantData.backgroundColor || '#f8fafc',
        catalogLayout: tenantData.catalogLayout || 'mixed',
        logoUrl: tenantData.logoUrl || ''
      });
    }
  }, [tenantData]);

  // Guardar cambios del tenant en Storage y Firestore
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      let finalLogoUrl = tenantSettings.logoUrl;

      // Subir el logotipo si el administrador cargó un archivo nuevo
      if (logoFile) {
        const logoRef = ref(storage, `tenants/${tenantId}/logo_${Date.now()}`);
        const snapshot = await uploadBytes(logoRef, logoFile);
        finalLogoUrl = await getDownloadURL(snapshot.ref);
      }

      const tenantRef = doc(db, 'tenants', tenantId);
      const payload = {
        name: tenantSettings.name,
        whatsappNumber: tenantSettings.whatsappNumber,
        primaryColor: tenantSettings.primaryColor,
        themeMode: tenantSettings.themeMode,
        backgroundColor: tenantSettings.backgroundColor,
        catalogLayout: tenantSettings.catalogLayout,
        logoUrl: finalLogoUrl
      };

      await setDoc(tenantRef, payload, { merge: true });
      
      setTenantSettings(prev => ({ ...prev, logoUrl: finalLogoUrl }));
      setLogoFile(null);
      
      toast.success("Configuración de marca guardada con éxito.");
      
      // Recargar para aplicar los colores del tema y el logo
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error("Error al guardar configuración:", error);
      toast.error("No se pudo guardar la configuración.");
    } finally {
      setSettingsSaving(false);
    }
  };
  
  // Estado para el modal de edición de propiedad
  const [editingProperty, setEditingProperty] = useState(null);
  const [formData, setFormData] = useState({});

  // Estado para el modal de registro de nuevo operador
  const [showAddOperatorModal, setShowAddOperatorModal] = useState(false);
  const [operatorForm, setOperatorForm] = useState({ name: '', email: '', phone: '+54 9 ' });
  const [operatorSubmitting, setOperatorSubmitting] = useState(false);
  const [operatorError, setOperatorError] = useState('');
  const [isDeleting, setIsDeleting] = useState(null);
  
  // Estados para contraseñas y éxito de operadores
  const [createdOperatorData, setCreatedOperatorData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);

  // Estado para la generación de PDF
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const [flyerProperty, setFlyerProperty] = useState(null);
  const [generatingSignage, setGeneratingSignage] = useState(null);
  const [signageProperty, setSignageProperty] = useState(null);

  // 1. Escuchar propiedades en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, 'properties'),
      where('tenant_id', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tempProperties = [];
      snapshot.forEach((doc) => {
        tempProperties.push({ id: doc.id, ...doc.data() });
      });
      tempProperties.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProperties(tempProperties);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener las propiedades de administración:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // 2. Escuchar operadores autorizados (solo si el usuario actual es admin)
  useEffect(() => {
    if (!userClaims.admin) return;

    const q = query(
      collection(db, 'operadores'),
      where('tenant_id', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tempOperators = [];
      snapshot.forEach((doc) => {
        tempOperators.push({ phone: doc.id, ...doc.data() });
      });
      setOperators(tempOperators);
      setOperatorsLoading(false);
    }, (error) => {
      console.error("Error al obtener lista de operadores:", error);
      setOperatorsLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, userClaims.admin]);

  // 3. Filtrar según la pestaña activa y la búsqueda
  useEffect(() => {
    if (activeTab === 'operators') return; // Se renderiza con una lógica distinta

    let result = properties.filter((p) => p.status === activeTab);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(term)) ||
          (p.address && p.address.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term)) ||
          (p.metadata?.sender && p.metadata.sender.includes(term))
      );
    }

    setFilteredProperties(result);
  }, [properties, activeTab, searchTerm]);

  // Acciones sobre Propiedades
  const handleApprove = async (id) => {
    try {
      const docRef = doc(db, 'properties', id);
      await updateDoc(docRef, {
        status: 'approved',
        updatedAt: new Date()
      });
      toast.success("Propiedad publicada exitosamente.");
    } catch (error) {
      console.error("Error al aprobar propiedad:", error);
      toast.error("Error al publicar la propiedad.");
    }
  };

  const handleArchive = async (id) => {
    try {
      const docRef = doc(db, 'properties', id);
      await updateDoc(docRef, {
        status: 'archived',
        updatedAt: new Date()
      });
      toast.info("Propiedad archivada.");
    } catch (error) {
      console.error("Error al archivar propiedad:", error);
      toast.error("Error al archivar la propiedad.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar permanentemente esta propiedad?")) return;
    try {
      const docRef = doc(db, 'properties', id);
      await deleteDoc(docRef);
      toast.success("Propiedad eliminada correctamente.");
    } catch (error) {
      console.error("Error al eliminar propiedad:", error);
      toast.error("Error al eliminar la propiedad.");
    }
  };

  const handleOpenEditModal = (property) => {
    setEditingProperty(property);
    setFormData({
      title: property.title || '',
      address: property.address || '',
      price: property.price || '',
      currency: property.currency || 'USD',
      rooms: property.rooms || '',
      bathrooms: property.bathrooms || '',
      area: property.area || '',
      description: property.description || '',
      propertyType: property.propertyType || 'Departamento',
      operationType: property.operationType || 'Alquiler',
      featured: property.featured || false,
      latitude: property.latitude || '',
      longitude: property.longitude || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProperty) return;

    try {
      const docRef = doc(db, 'properties', editingProperty.id);
      await updateDoc(docRef, {
        ...formData,
        price: formData.price ? Number(formData.price) : null,
        rooms: formData.rooms ? Number(formData.rooms) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        area: formData.area ? Number(formData.area) : null,
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null,
        updatedAt: new Date()
      });
      setEditingProperty(null);
      toast.success("Cambios guardados con éxito.");
    } catch (error) {
      console.error("Error al modificar propiedad:", error);
      toast.error("Error al guardar los cambios.");
    }
  };

  const getWhatsAppInviteLink = () => {
    if (!createdOperatorData) return '';
    const cleanPhone = createdOperatorData.phone.replace(/\+/g, '').replace(/\D/g, '');
    const botPhone = '5492364459744'; // Número oficial del bot asistente Inmos
    
    const message = `¡Hola ${createdOperatorData.name}! Te agregué como operador para ${tenantData?.name || 'Inmos'}.

Para empezar a cargar propiedades usando Inteligencia Artificial, primero agenda este número de la plataforma y enviale un mensaje haciendo clic en el siguiente enlace:

👉 https://wa.me/${botPhone}?text=Hola

Tus credenciales de ingreso para el panel de administración son:
📧 Usuario: ${createdOperatorData.email}
🔑 Contraseña temporal: ${createdOperatorData.tempPassword}

¡Bienvenido!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // Creación de Operador por Cloud Function Callable
  const handleAddOperator = async (e) => {
    e.preventDefault();
    setOperatorError('');
    setOperatorSubmitting(true);

    try {
      const functions = getFunctions();
      const createOperatorFn = httpsCallable(functions, 'createOperator');
      
      const result = await createOperatorFn({
        name: operatorForm.name,
        email: operatorForm.email,
        phone: operatorForm.phone
      });

      toast.success("Operador autorizado con éxito.");
      setCreatedOperatorData({
        name: operatorForm.name,
        email: result.data.email || `${operatorForm.email}@${tenantId}.com`,
        phone: result.data.phone || operatorForm.phone,
        tempPassword: result.data.tempPassword
      });
    } catch (error) {
      console.error("Error al crear operador mediante Cloud Function:", error);
      setOperatorError(error.message || 'Error al procesar el alta de operador.');
      toast.error("Error al autorizar operador.");
    } finally {
      setOperatorSubmitting(false);
    }
  };

  // Actualizar contraseña de Firebase Auth para el usuario logueado
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setPassSaving(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success("Contraseña actualizada con éxito.");
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error("Error al actualizar contraseña:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error("Por seguridad, por favor cierra sesión y vuelve a ingresar para cambiar tu contraseña.");
      } else {
        toast.error(error.message || "No se pudo actualizar la contraseña.");
      }
    } finally {
      setPassSaving(false);
    }
  };

  // Eliminar Operador de Firestore / Revocar acceso
  const handleDeleteOperator = async (phone) => {
    if (!window.confirm("¿Seguro que deseas revocar el acceso a este operador? Se eliminará de la base de datos y de Firebase Auth, y ya no podrá enviar publicaciones por WhatsApp.")) return;
    setIsDeleting(phone);
    try {
      const functions = getFunctions();
      const deleteOperatorFn = httpsCallable(functions, 'deleteOperator');
      await deleteOperatorFn({ phone });
      
      toast.success("Acceso del operador revocado y cuenta eliminada.");
    } catch (error) {
      console.error("Error al revocar acceso de operador:", error);
      toast.error(error.message || "Error al revocar acceso.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      console.log("Sesión de operador finalizada.");
    });
  };

  // Exportar datos llamando a la Cloud Function
  const handleExport = async () => {
    try {
      const functions = getFunctions();
      const exportFn = httpsCallable(functions, 'exportTenantData');
      const result = await exportFn({ tenantId });
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `inmos_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success("Catálogo descargado correctamente.");
    } catch (error) {
      console.error("Error al exportar datos:", error);
      toast.error("Error al exportar el catálogo.");
    }
  };

  // Solicitar recorrido virtual
  const handleRequestVirtualTour = async (prop) => {
    try {
      const docRef = doc(db, 'properties', prop.id);
      await updateDoc(docRef, { virtualTourRequested: true });
      
      const message = `Hola equipo Inmos, quiero contratar un recorrido virtual 360° para la propiedad: ${prop.title || 'Sin Título'} (ID: ${prop.id}).`;
      // Número dummy para la demo
      const waUrl = `https://wa.me/5491199999999?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      
    } catch (error) {
      console.error("Error al solicitar recorrido:", error);
    }
  };

  // Generar y descargar Flyer PDF
  const handleGeneratePdf = async (prop) => {
    setGeneratingPdf(prop.id);
    setFlyerProperty(prop);
    
    setTimeout(async () => {
      try {
        const element = document.getElementById(`flyer-${prop.id}`);
        if (!element) throw new Error("Elemento Flyer no encontrado en el DOM");

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        pdf.save(`Inmos_Flyer_${prop.title?.replace(/\s+/g, '_') || prop.id}.pdf`);
        toast.success("Folleto PDF generado exitosamente.");
        
      } catch (error) {
        console.error("Error al generar el PDF:", error);
        toast.error("Hubo un error al generar el Flyer PDF. Revisa tu conexión.");
      } finally {
        setGeneratingPdf(null);
        setFlyerProperty(null);
      }
    }, 600);
  };

  // Generar Cartel de Vía Pública (QR Gigante)
  const handleGenerateSignage = async (prop) => {
    setGeneratingSignage(prop.id);
    setSignageProperty(prop);
    
    setTimeout(async () => {
      try {
        const element = document.getElementById(`signage-${prop.id}`);
        if (!element) throw new Error("Elemento Signage no encontrado en el DOM");

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        pdf.save(`Inmos_CartelQR_${prop.id}.pdf`);
        toast.success("Cartel de vía pública generado exitosamente.");
        
      } catch (error) {
        console.error("Error al generar el Cartel QR:", error);
        toast.error("Hubo un error al generar el Cartel. Revisa tu conexión.");
      } finally {
        setGeneratingSignage(null);
        setSignageProperty(null);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-brand-500 font-semibold tracking-wider uppercase text-[10px]">Administración Inmobiliaria</span>
            <span className="bg-brand-950/60 text-brand-300 border border-brand-900/30 text-[9px] px-2 py-0.5 rounded font-mono uppercase">{tenantId}</span>
            {userClaims.admin && (
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 text-[9px] px-2 py-0.5 rounded font-semibold uppercase flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            )}
            {tenantData?.plan === 'pro' && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-2 py-0.5 rounded font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                <Star className="h-3 w-3 fill-amber-300" /> PRO
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Panel Corporativo
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Logueado como: <span className="text-slate-200 font-medium">{currentUser?.email}</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExport}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold px-4 py-3 rounded-2xl flex items-center justify-center gap-2 transition border border-slate-750 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Exportar Catálogo
          </button>
          <a 
            href={`/?tenant=${tenantId}`}
            className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold px-4 py-3 rounded-2xl flex items-center justify-center transition border border-slate-750 shadow-sm"
          >
            Ver mi catálogo
          </a>
          <button 
            onClick={handleLogout}
            className="text-xs bg-red-950/20 text-red-400 border border-red-500/10 hover:bg-red-500/10 font-bold px-4 py-3 rounded-2xl flex items-center justify-center gap-2 transition"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Controles de Pestañas y Búsqueda */}
      <div className="max-w-7xl mx-auto mb-8 bg-slate-800/40 border border-slate-700/45 p-4 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Pestañas de Navegación */}
        <div className="flex flex-wrap bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 sm:gap-0">
          {[
            { id: 'pending', label: 'Pendientes', count: properties.filter(p => p.status === 'pending').length },
            { id: 'approved', label: 'Aprobadas', count: properties.filter(p => p.status === 'approved').length },
            { id: 'archived', label: 'Archivadas', count: properties.filter(p => p.status === 'archived').length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${activeTab === tab.id ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab.label}
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${activeTab === tab.id ? 'bg-brand-600 text-white' : 'bg-slate-850 text-slate-350'}`}>
                {tab.count}
              </span>
            </button>
          ))}

          {/* Pestaña de Gestión de Operadores (Solo visible para admins) */}
          {userClaims.admin && (
            <button
              onClick={() => setActiveTab('operators')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${activeTab === 'operators' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Users className="h-4 w-4" />
              Operadores
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${activeTab === 'operators' ? 'bg-emerald-700 text-white' : 'bg-slate-850 text-slate-350'}`}>
                {operators.length}
              </span>
            </button>
          )}

          {/* Pestaña de Configuración y Perfil (Visible para todos) */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${activeTab === 'settings' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Settings className="h-4 w-4" />
            {userClaims.admin ? 'Configuración' : 'Mi Perfil'}
          </button>
        </div>

        {/* Buscador (No visible en las pestañas de administración para simplificar) */}
        {activeTab !== 'operators' && activeTab !== 'settings' && (
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
            <input
              type="text"
              placeholder="Busca propiedades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-850 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        )}
      </div>

      {/* Vista de Catálogo de Propiedades o Vista de Gestión de Operadores */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'settings' ? (
          <div className="space-y-8 max-w-2xl mx-auto">
            {/* 1. CONFIGURACIÓN DE MARCA BLANCA (Solo Admin) */}
            {userClaims.admin && (
              <div className="bg-slate-800/20 border border-slate-800 rounded-3xl p-6 md:p-8">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Settings className="h-5.5 w-5.5 text-indigo-500" />
                  Configuración de Marca Blanca
                </h2>
                <p className="text-slate-400 text-xs mb-6">
                  Personaliza el logotipo, nombre, color de marca y datos de contacto de tu portal público.
                </p>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {/* Nombre */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre de la Inmobiliaria</label>
                    <input 
                      type="text"
                      required
                      value={tenantSettings.name}
                      onChange={(e) => setTenantSettings(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500"
                      placeholder="Ej: López Propiedades"
                    />
                  </div>

                  {/* WhatsApp de Contacto */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">WhatsApp de Contacto Oficial</label>
                    <input 
                      type="text"
                      required
                      value={tenantSettings.whatsappNumber}
                      onChange={(e) => setTenantSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500"
                      placeholder="Ej: 5491165432100"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Con código de país y código móvil (Ej: 549...). Se usará como contacto por defecto.</span>
                  </div>

                  {/* Color de Marca */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Color Primario (Tema)</label>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      {[
                        { hex: '#0b57d0', name: 'Azul Inmos' },
                        { hex: '#1e3a8a', name: 'Azul Marino' },
                        { hex: '#059669', name: 'Esmeralda' },
                        { hex: '#4f46e5', name: 'Índigo' },
                        { hex: '#d97706', name: 'Ámbar' },
                        { hex: '#e11d48', name: 'Rosa' },
                        { hex: '#374151', name: 'Carbón' }
                      ].map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setTenantSettings(prev => ({ ...prev, primaryColor: color.hex }))}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                          className={`h-7 w-7 rounded-full border-2 transition ${tenantSettings.primaryColor === color.hex ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color"
                        value={tenantSettings.primaryColor}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="h-10 w-12 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer p-1"
                      />
                      <input 
                        type="text"
                        value={tenantSettings.primaryColor}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white w-28 uppercase font-mono text-center focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  {/* Removed visual theme mode to stick with the default light theme for now. Primary color remains. */}

                  {/* Layout del Catálogo */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Vista por Defecto del Catálogo</label>
                    <div className="flex gap-3">
                      <select
                        value={tenantSettings.catalogLayout}
                        onChange={(e) => setTenantSettings(prev => ({ ...prev, catalogLayout: e.target.value }))}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500 w-full"
                      >
                        <option value="mixed">Mixta (Lista + Mapa)</option>
                        <option value="grid">Solo Lista (Grid de tarjetas)</option>
                        <option value="map">Solo Mapa</option>
                      </select>
                    </div>
                  </div>

                  {/* Logotipo */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Logotipo de la Inmobiliaria</label>
                    <div className="flex items-center gap-5 bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
                      <div className="h-16 w-32 border border-slate-800 bg-slate-950 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        {logoPreview || tenantSettings.logoUrl ? (
                          <img src={logoPreview || tenantSettings.logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-600">Sin Logotipo</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setLogoFile(file);
                              setLogoPreview(URL.createObjectURL(file));
                            }
                          }}
                          className="hidden"
                          id="logo-upload-input"
                        />
                        <label 
                          htmlFor="logo-upload-input"
                          className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition inline-block mb-1.5"
                        >
                          Seleccionar Archivo
                        </label>
                        <p className="text-[9px] text-slate-500">Se recomienda formato PNG transparente y fondo claro, máx. 2MB.</p>
                      </div>
                    </div>
                  </div>

                  {/* Botón de Guardado */}
                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-brand-500/10"
                    >
                      {settingsSaving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {settingsSaving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. CAMBIAR CONTRASEÑA (Para todos) */}
            <div className="bg-slate-800/20 border border-slate-800 rounded-3xl p-6 md:p-8">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Key className="h-5.5 w-5.5 text-emerald-500" />
                Seguridad de la Cuenta
              </h2>
              <p className="text-slate-400 text-xs mb-6">
                Actualiza tu contraseña para mantener la seguridad de tu panel de operador.
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nueva Contraseña</label>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Confirmar Nueva Contraseña</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500"
                    placeholder="Repite la contraseña"
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={passSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-emerald-600/10"
                  >
                    {passSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Actualizar Contraseña
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : activeTab === 'operators' ? (
          
          /* --- SECCIÓN GESTIÓN DE OPERADORES --- */
          <div className="bg-slate-800/20 border border-slate-800 rounded-3xl p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Users className="h-5.5 w-5.5 text-emerald-500" />
                  Operadores Autorizados
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Listado de asesores inmobiliarios autorizados para publicar propiedades en tu inmobiliaria a través de WhatsApp.
                </p>
              </div>
              <div className="flex gap-3 self-start">
                <a
                  href="https://wa.me/5492364459744?text=Hola"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition shadow-lg border border-emerald-900/50"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat con Inmos App
                </a>
                <button
                  onClick={() => {
                    if (tenantData?.plan !== 'pro' && operators.length >= 2) {
                      toast.error('El plan Básico permite hasta 2 operadores. Actualice a PRO para añadir más.', { duration: 5000 });
                      return;
                    }
                    setShowAddOperatorModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition shadow-lg shadow-emerald-600/10"
                >
                  <UserPlus className="h-4 w-4" />
                  Registrar Operador
                </button>
              </div>
            </div>

            {operatorsLoading ? (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : operators.length === 0 ? (
              <div className="bg-slate-900/40 rounded-2xl border border-slate-850 p-8 text-center max-w-sm mx-auto">
                <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <h3 className="font-bold text-slate-200 text-sm">Sin operadores registrados</h3>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                  Registra operadores con su número de WhatsApp para comenzar a recibir sus publicaciones.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                      <th className="py-4 px-4">Operador</th>
                      <th className="py-4 px-4">WhatsApp Autorizado</th>
                      <th className="py-4 px-4">Email de Acceso</th>
                      <th className="py-4 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {operators.map((op) => (
                      <tr key={op.phone} className="hover:bg-slate-850/20 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-100">{op.nombre || op.name || 'Asesor Sin Nombre'}</td>
                        <td className="py-4 px-4 font-mono text-slate-300 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-500" />
                          {op.phone}
                        </td>
                        <td className="py-4 px-4 text-slate-400 font-mono">
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-500" />
                            {op.email || 'No configurado'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => handleDeleteOperator(op.phone)}
                            disabled={isDeleting === op.phone}
                            className={`p-2 rounded-lg transition-colors ${isDeleting === op.phone ? 'text-slate-500 bg-slate-800' : 'text-red-400 hover:text-red-300 hover:bg-red-900/30'}`}
                            title="Eliminar acceso"
                          >
                            {isDeleting === op.phone ? (
                              <div className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          
          /* --- SECCIÓN PANELES DE PROPIEDADES (PENDIENTES/APROBADAS/ARCHIVADAS) --- */
          loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="bg-slate-800/20 border border-slate-700/20 rounded-3xl p-12 text-center max-w-md mx-auto mt-6">
              <div className="h-14 w-14 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <Home className="h-7 w-7 text-slate-500" />
              </div>
              <h3 className="font-bold text-slate-200 text-base">No hay propiedades aquí</h3>
              <p className="text-slate-400 mt-2 text-xs leading-relaxed">
                No se encontraron propiedades en el estado "{activeTab}" que coincidan con la búsqueda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProperties.map((prop) => (
                <div 
                  key={prop.id} 
                  className="bg-slate-800/40 border border-slate-800 rounded-3xl overflow-hidden flex flex-col hover:border-slate-700 transition-all duration-300 group"
                >
                  <div className="relative h-48 bg-slate-950 overflow-hidden shrink-0">
                    {prop.images && prop.images.length > 0 ? (
                      <img 
                        src={prop.images[0]} 
                        alt={prop.title} 
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1.5">
                        <Home className="h-8 w-8 stroke-1" />
                        <span className="text-xs">Sin imágenes cargadas</span>
                      </div>
                    )}

                    <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                      <span className="bg-slate-900/80 text-brand-400 border border-brand-900/30 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-md">
                        {prop.operationType || 'Operación'}
                      </span>
                      <span className="bg-slate-900/80 text-slate-300 border border-slate-750 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-md">
                        {prop.propertyType || 'Tipo'}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                      {prop.featured && (
                        <div className="bg-yellow-500 text-slate-950 p-1.5 rounded-full shadow-md">
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        {(prop.views > 0 || prop.status === 'approved') && (
                          <div className="bg-slate-900/80 text-slate-300 border border-slate-750 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1.5 backdrop-blur-md" title="Vistas orgánicas">
                            <Eye className="h-3.5 w-3.5 text-slate-400" />
                            {prop.views || 0}
                          </div>
                        )}
                        {prop.inquiries > 0 && (
                          <div className="bg-emerald-900/80 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md flex items-center gap-1.5 backdrop-blur-md" title="Consultas (Clics en WhatsApp)">
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                            {prop.inquiries || 0}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className="font-extrabold text-base text-slate-100 line-clamp-1">
                        {prop.title || "Nueva propiedad sin revisar"}
                      </h3>
                      <div className="text-brand-500 font-extrabold text-base whitespace-nowrap">
                        {prop.price ? `${prop.currency || 'USD'} ${prop.price.toLocaleString()}` : "Consultar"}
                      </div>
                    </div>

                    <p className="text-slate-400 text-xs flex items-center gap-1.5 mb-4">
                      <Compass className="h-3.5 w-3.5 text-slate-500" />
                      {prop.address || "Dirección no completada"}
                    </p>

                    <div className="grid grid-cols-3 gap-2.5 mb-4 bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl text-[11px] text-slate-300">
                      <div>
                        <span className="block text-slate-500 text-[9px] uppercase font-semibold">Dormitorios</span>
                        <span className="font-bold">{prop.rooms || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-[9px] uppercase font-semibold">Baños</span>
                        <span className="font-bold">{prop.bathrooms || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-[9px] uppercase font-semibold">Superficie</span>
                        <span className="font-bold">{prop.area ? `${prop.area} m²` : '—'}</span>
                      </div>
                    </div>

                    <p className="text-slate-350 text-xs line-clamp-2 mb-5 flex-1 leading-relaxed">
                      {prop.description || "Sin descripción asignada por el bot."}
                    </p>

                    {prop.metadata && (
                      <div className="border-t border-slate-800/80 pt-3.5 mb-4 flex items-center gap-2 text-slate-400 text-[10px]">
                        <MessageSquare className="h-3.5 w-3.5 text-brand-500" />
                        <span>Cargado por: <strong className="text-slate-300">{prop.metadata.sender}</strong></span>
                      </div>
                    )}

                    <div className="mb-5">
                      <button 
                        onClick={() => handleRequestVirtualTour(prop)}
                        className={`w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition border ${prop.virtualTourUrl ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 cursor-default' : prop.virtualTourRequested ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 text-slate-400 border-slate-700'}`}
                        disabled={!!prop.virtualTourUrl}
                      >
                        <Video className="h-3.5 w-3.5" />
                        {prop.virtualTourUrl ? 'Recorrido 360° Activo' : prop.virtualTourRequested ? 'Recorrido Solicitado' : 'Solicitar Recorrido 360°'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(prop)}
                          className="flex-1 bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </button>

                        <button 
                          onClick={() => handleGeneratePdf(prop)}
                          disabled={generatingPdf === prop.id || generatingSignage === prop.id}
                          className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition border border-rose-500/20"
                          title="Descargar Folleto Comercial (A4)"
                        >
                          {generatingPdf === prop.id ? (
                            <div className="h-3.5 w-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          Folleto
                        </button>

                        <button 
                          onClick={() => handleGenerateSignage(prop)}
                          disabled={generatingSignage === prop.id || generatingPdf === prop.id}
                          className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition border border-indigo-500/20"
                          title="Descargar Cartel para Vía Pública (A4)"
                        >
                          {generatingSignage === prop.id ? (
                            <div className="h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Printer className="h-3.5 w-3.5" />
                          )}
                          Cartel QR
                        </button>
                      </div>

                      <div className="flex gap-2">
                        {activeTab === 'pending' && (
                          <button 
                            onClick={() => handleApprove(prop.id)}
                            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition shadow-lg shadow-brand-500/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Aprobar
                          </button>
                        )}

                        {activeTab === 'approved' && (
                          <button 
                            onClick={() => handleArchive(prop.id)}
                            className="flex-1 bg-slate-750 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Archivar
                          </button>
                        )}

                        <button 
                          onClick={() => handleDelete(prop.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 p-2.5 rounded-xl transition"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      {/* Modal de Modificación de Propiedad */}
      {editingProperty && (
        <PropertyEditModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onUpdated={(updatedProp) => {
            console.log(`Propiedad ${updatedProp.id} actualizada vía modal.`);
          }}
        />
      )}

      {/* Modal de Registro de Nuevo Operador (Solo visible para admins) */}
      {showAddOperatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-emerald-500" />
                Registrar Operador
              </h2>
              <button 
                onClick={() => {
                  setShowAddOperatorModal(false);
                  setOperatorError('');
                  setCreatedOperatorData(null);
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createdOperatorData ? (
              /* --- VISTA DE ÉXITO CON LA CONTRASEÑA --- */
              <div className="p-6 space-y-5">
                <div className="bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs p-4 rounded-2xl flex flex-col gap-2">
                  <span className="font-bold text-sm">✓ Operador registrado con éxito</span>
                  <p className="text-slate-300 leading-normal text-[11px]">
                    El operador se ha creado correctamente. Comparte las siguientes credenciales para que pueda ingresar al panel:
                  </p>
                </div>

                <div className="flex flex-col gap-4 bg-slate-900/60 border border-slate-850 p-5 rounded-2xl text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Usuario (Email)</span>
                    <span className="font-mono text-slate-200 select-all break-all">{createdOperatorData.email}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Teléfono</span>
                    <span className="font-mono text-slate-200 select-all">{createdOperatorData.phone}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Contraseña Temporal</span>
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 border border-slate-800 rounded-xl mt-1">
                      <span className="font-mono text-emerald-400 font-bold flex-1 select-all tracking-wider break-all">{createdOperatorData.tempPassword}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdOperatorData.tempPassword);
                          toast.success("Contraseña copiada al portapapeles.");
                        }}
                        className="bg-slate-850 hover:bg-slate-800 text-[10px] font-bold text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 active:scale-95 transition shrink-0"
                      >
                        Copiar
                      </button>
                    </div>
                    <span className="text-[9px] text-amber-500 font-semibold mt-1">⚠️ Importante: Copia esta contraseña ahora. No volverá a mostrarse por seguridad.</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    href={getWhatsAppInviteLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    Enviar Invitación por WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddOperatorModal(false);
                      setCreatedOperatorData(null);
                      setOperatorForm({ name: '', email: '', phone: '+54 9 ' });
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3 rounded-xl text-xs transition border border-slate-700/50"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              </div>
            ) : (
              /* --- FORMULARIO DE REGISTRO --- */
              <form onSubmit={handleAddOperator} className="p-6 space-y-4">
                {operatorError && (
                  <div className="bg-red-500/10 border border-red-500/15 text-red-400 text-xs p-3.5 rounded-xl flex gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 rotate-180" />
                    <span>{operatorError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre del operador</label>
                  <input 
                    type="text" 
                    value={operatorForm.name} 
                    onChange={(e) => setOperatorForm({...operatorForm, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                    placeholder="ej: Juan Gómez"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Usuario de acceso (Email)</label>
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden focus-within:border-emerald-500 transition">
                    <input 
                      type="text" 
                      value={operatorForm.email} 
                      onChange={(e) => setOperatorForm({...operatorForm, email: e.target.value})}
                      className="flex-1 bg-transparent px-3.5 py-2 text-xs text-slate-200 focus:outline-none border-0"
                      placeholder="ej: juan.gomez"
                      required
                    />
                    <span className="bg-slate-800 text-slate-400 text-xs px-3.5 py-2 border-l border-slate-700 font-mono font-bold select-none shrink-0">
                      @{tenantId}.com
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Teléfono de WhatsApp</label>
                  <input 
                    type="text" 
                    value={operatorForm.phone} 
                    onChange={(e) => setOperatorForm({...operatorForm, phone: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                    placeholder="ej: 91155556666"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Si no ingresas código de país, se agregará "54" (Argentina) por defecto.</span>
                </div>

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddOperatorModal(false);
                      setOperatorError('');
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-650 text-white font-bold py-2.5 rounded-xl text-xs"
                    disabled={operatorSubmitting}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-1.5"
                    disabled={operatorSubmitting}
                  >
                    {operatorSubmitting ? (
                      <div className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        Crear Operador
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Renderizado invisible del Flyer para PDF */}
      {flyerProperty && (
        <PropertyFlyer property={flyerProperty} tenantId={tenantId} />
      )}

      {/* Renderizado invisible del Cartel de Calle para PDF */}
      {signageProperty && (
        <SignageFlyer property={signageProperty} tenantId={tenantId} />
      )}
      {/* Asistente IA para Operadores (No Demo) */}
      <AIChatAssistant 
        isDemo={false} 
        tenantId={tenantId} 
        sessionId={currentUser?.uid || currentUser?.email || 'operador'} 
      />
    </div>
  );
}
