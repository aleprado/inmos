import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-slate-800 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        <a href="/" className="inline-flex items-center text-brand-600 font-bold mb-8 hover:underline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al Inicio
        </a>
        <h1 className="text-3xl font-black mb-6 text-slate-900">Política de Privacidad</h1>
        <p className="text-sm text-slate-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3">1. Información que recopilamos</h2>
            <p>Nuestra plataforma, a través de la integración con WhatsApp Business API, recopila únicamente la información necesaria para el funcionamiento del catálogo inmobiliario y la atención al cliente. Esto incluye el número de teléfono desde el cual se envían las consultas y el contenido de los mensajes de texto o audio (propiamente relacionados a publicaciones inmobiliarias).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">2. Uso de la información</h2>
            <p>La información recopilada es utilizada exclusivamente para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
              <li>Generar de forma automatizada las publicaciones en el catálogo inmobiliario.</li>
              <li>Responder a las consultas de los clientes a través del asistente virtual de WhatsApp.</li>
              <li>Medir estadísticas de visualizaciones y consultas de las propiedades.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">3. Compartición de datos</h2>
            <p>No vendemos, alquilamos ni compartimos la información personal de nuestros usuarios o sus clientes con terceros ajenos al servicio. Los datos se procesan utilizando infraestructuras seguras de Google Cloud (Firebase) y Meta (WhatsApp Business API) en cumplimiento con sus respectivas normativas de seguridad.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">4. Derechos del usuario</h2>
            <p>Los administradores de las inmobiliarias tienen derecho a acceder, rectificar o eliminar cualquier publicación o dato ingresado en su catálogo a través de nuestro panel de control de acceso seguro.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">5. Contacto</h2>
            <p>Si tiene alguna duda sobre nuestra política de privacidad, puede contactar al administrador del sistema a través de los canales oficiales de soporte.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
