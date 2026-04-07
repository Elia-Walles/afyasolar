"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sun,
  Users,
  ArrowRight,
  Activity,
  CreditCard,
  Smartphone,
  Shield,
  Lightbulb,
  Headphones,
  Menu,
  X,
  ChevronRight,
  ArrowUp,
  HelpCircle,
  Zap,
  TrendingUp,
  Sparkles,
  Globe,
  Star,
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Mouse tracking for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/30 via-white to-green-50/20 relative overflow-hidden">
      {/* Animated background gradients */}
      <div 
        className="fixed inset-0 -z-10 opacity-40"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(34, 197, 94, 0.25) 0%, transparent 50%)`,
        }}
      />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-200/50 to-emerald-200/40 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-green-200/40 to-emerald-100/50 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-green-100/30 to-emerald-100/30 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '0.5s' }} />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-600 focus:text-white focus:rounded-lg focus:shadow-xl"
      >
        Skip to main content
      </a>

      {/* Navigation Header - Glassmorphism */}
      <header className="border-b border-green-200/60 bg-green-50/60 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group" aria-label="AfyaSolar Home">
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-green-600 via-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110 group-hover:rotate-12">
                  <Sun className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">AfyaSolar</h1>
                <p className="text-xs text-gray-600 font-medium">Smart Energy for Health</p>
              </div>
            </Link>
            
            <div className="hidden md:flex items-center gap-3">
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs h-10 px-6 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105" 
                asChild
              >
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2.5 rounded-xl hover:bg-gray-100 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-green-100 pt-4 animate-in slide-in-from-top-5 duration-300">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs h-10 flex-1 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl" 
                  asChild
                >
                  <Link href="/auth/signin">Sign In</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main id="main-content">
        {/* Hero Section - Modern Design */}
        <section className="relative py-12 md:py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="text-center mb-8">
              {/* Animated Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-700 rounded-full text-xs font-bold mb-6 shadow-lg backdrop-blur-sm hover:scale-105 transition-transform">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Trusted by 500+ Healthcare Facilities</span>
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              </div>

              <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight">
                <span className="text-gray-900">Track Energy, Pay Smart</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 animate-gradient">
                  & Go Solar
                </span>
                <br />
                <span className="text-gray-900">All in One App</span>
              </h2>
              
              <p className="text-base md:text-lg text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed font-medium">
                The smartest way to manage power needs for Tanzanian healthcare facilities. Monitor consumption, make
                payments, and switch to solar—all in one easy app.
              </p>
              
              {/* Quick Value Proposition - Modern Pills */}
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {[
                  { icon: TrendingUp, text: "Reduce costs by up to 40%", color: "from-green-500 to-emerald-500" },
                  { icon: Activity, text: "24/7 real-time monitoring", color: "from-blue-500 to-cyan-500" },
                  { icon: Smartphone, text: "Instant mobile payments", color: "from-purple-500 to-pink-500" }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className="group flex items-center gap-2.5 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:shadow-xl border border-gray-200/50 hover:border-green-300 transition-all hover:scale-105 cursor-pointer"
                  >
                    <div className={`w-8 h-8 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                      <item.icon className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  className="group bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-700 hover:via-green-600 hover:to-emerald-700 text-sm h-14 px-10 shadow-2xl hover:shadow-green-500/50 transition-all transform hover:scale-105 font-bold" 
                  asChild
                >
                  <Link href="/auth/signup">
                    <span>Register Your Facility</span>
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-sm h-14 px-8 border-2 border-gray-300 hover:bg-green-50 hover:border-green-500 hover:text-green-700 text-gray-900 font-semibold transition-all" 
                  asChild
                >
                  <Link href="/auth/signin">View Live Dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features - Modern Grid */}
        <section id="features" className="py-12 px-4 bg-gradient-to-b from-green-50/40 via-white to-green-50/30 relative">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-700 rounded-full text-xs font-bold mb-5 shadow-sm">
                <Zap className="w-4 h-4" />
                <span>Features</span>
              </div>
              <h3 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
                Smart Energy <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">Intelligence</span>
              </h3>
              <p className="text-base text-gray-600 max-w-2xl mx-auto">
                Everything you need to manage energy efficiently for your healthcare facility
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Activity, title: "Live Monitoring", desc: "Real-time power usage tracking—no more surprise bills", gradient: "from-green-500 to-emerald-500", bg: "from-green-50 to-emerald-50" },
                { icon: Smartphone, title: "Instant Top-Up", desc: "Pay electricity bills quickly via mobile money", gradient: "from-blue-500 to-cyan-500", bg: "from-blue-50 to-cyan-50" },
                { icon: Sun, title: "Solar Solutions", desc: "Customized solar energy systems designed specifically for your healthcare facility's needs", gradient: "from-yellow-500 to-orange-500", bg: "from-yellow-50 to-orange-50" },
                { icon: CreditCard, title: "Payment Flexibility", desc: "Wallet, card, bank transfer, mobile money—all supported", gradient: "from-purple-500 to-pink-500", bg: "from-purple-50 to-pink-50" },
                { icon: Headphones, title: "Priority Support", desc: "Dispute bills, report faults, request services instantly", gradient: "from-indigo-500 to-purple-500", bg: "from-indigo-50 to-purple-50" },
                { icon: Lightbulb, title: "Smart Tips", desc: "AI-powered usage recommendations for maximum savings", gradient: "from-green-500 to-teal-500", bg: "from-green-50 to-teal-50" },
              ].map((feature, index) => (
                <Card 
                  key={index} 
                  className="border border-green-100/50 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-3 group bg-white/95 backdrop-blur-sm overflow-hidden relative"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.bg} opacity-20 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardHeader className="pb-4 relative z-10">
                    <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-5 shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                      <feature.icon className="w-8 h-8 text-white" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-lg font-bold text-gray-900">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {feature.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Modern Visual Flow */}
        <section id="how-it-works" className="py-12 px-4 bg-gradient-to-b from-green-50/50 via-white to-green-50/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, rgba(34, 197, 94, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 197, 94, 0.15) 1px, transparent 1px)' }} />
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-700 rounded-full text-xs font-bold mb-5 shadow-sm">
                <Sparkles className="w-4 h-4" />
                <span>Process</span>
              </div>
              <h3 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
                How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">Works</span>
              </h3>
              <p className="text-base text-gray-600">Get started in three simple steps</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10 relative">
              {/* Modern connecting line */}
              <div className="hidden md:block absolute top-20 left-1/4 right-1/4 h-1.5 bg-gradient-to-r from-green-200 via-green-400 to-green-200 rounded-full -z-10 shadow-lg" />
              
              {[
                { step: 1, icon: Users, title: "Register", desc: "Sign up with your facility details and complete email verification", gradient: "from-green-500 to-emerald-500", delay: "0s" },
                { step: 2, icon: Zap, title: "Connect", desc: "Link your smart meters and energy monitoring devices", gradient: "from-blue-500 to-cyan-500", delay: "0.2s" },
                { step: 3, icon: TrendingUp, title: "Monitor", desc: "Track usage, make payments, and optimize energy consumption", gradient: "from-purple-500 to-pink-500", delay: "0.4s" },
              ].map((item, index) => (
                <div key={index} className="text-center relative group">
                  <div className={`w-24 h-24 bg-gradient-to-br ${item.gradient} text-white rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl font-extrabold shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 relative z-10`}>
                    {item.step}
                    <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl" />
                  </div>
                  <div className={`w-20 h-20 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl group-hover:scale-110 transition-all duration-300`}>
                    <item.icon className="w-10 h-10 text-white" aria-hidden="true" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.desc}
                  </p>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-12 right-0 translate-x-1/2 z-20">
                      <ChevronRight className="w-10 h-10 text-green-300 drop-shadow-lg" aria-hidden="true" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section - Enhanced Accordion */}
        <section id="faq" className="py-12 px-4 bg-gradient-to-b from-green-50/40 via-white to-green-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, rgba(34, 197, 94, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 197, 94, 0.1) 1px, transparent 1px)' }} />
          <div className="container mx-auto max-w-5xl relative z-10">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2.5 px-5 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-700 rounded-full text-xs font-bold mb-6 shadow-lg backdrop-blur-sm">
                <HelpCircle className="w-4 h-4" />
                <span>Frequently Asked Questions</span>
              </div>
              <h3 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-5">
                Got <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">Questions?</span>
              </h3>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
                Find answers to common questions about AfyaSolar and how we can help your healthcare facility
              </p>
            </div>
            <div className="space-y-5">
              {[
                {
                  question: "How do I connect my smart meter?",
                  answer: "After registering your facility, you'll receive detailed instructions to connect your smart meter. Simply follow the step-by-step setup guide in your dashboard, or contact our dedicated support team for personalized assistance. Our technicians are also available for on-site installation if needed.",
                  icon: Activity
                },
                {
                  question: "What payment methods are accepted?",
                  answer: "We accept all major payment methods including M-Pesa, Airtel Money, Mixx by Yas, bank transfers, credit/debit cards, and wallet payments. All payment methods are secure, encrypted, and processed instantly. You can also set up automatic payments for convenience.",
                  icon: CreditCard
                },
                {
                  question: "Is my data secure?",
                  answer: "Yes, absolutely. We use bank-level encryption and advanced security measures to protect your data. All data transmission is encrypted using SSL/TLS protocols, and we comply with international data protection standards including GDPR. Your information is stored securely and never shared with third parties.",
                  icon: Shield
                },
                {
                  question: "How much does it cost?",
                  answer: "AfyaSolar offers flexible pricing plans tailored to your facility's needs. We provide Pay-As-You-Go, Installment, and Subscription models. Pricing depends on your energy consumption, facility size, and chosen plan. Contact us for a free consultation and customized quote that fits your budget.",
                  icon: TrendingUp
                },
                {
                  question: "What if I need technical support?",
                  answer: "We provide 24/7 priority support for all registered facilities. You can reach us through multiple channels: in-app chat, email, phone, or through your dashboard. Our expert support team is always ready to help with any issues, questions, or technical assistance you may need.",
                  icon: Headphones
                }
              ].map((faq, index) => (
                <Card 
                  key={index} 
                  className="border-2 border-green-100/60 shadow-xl hover:shadow-2xl transition-all bg-white/95 backdrop-blur-sm overflow-hidden group hover:border-green-300 hover:-translate-y-1"
                >
                  <CardHeader 
                    className="pb-5 cursor-pointer hover:bg-gradient-to-r hover:from-green-50/80 hover:to-emerald-50/80 transition-all duration-300 rounded-t-xl px-6 pt-6"
                    onClick={() => toggleFaq(index)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-14 h-14 bg-gradient-to-br ${index % 2 === 0 ? 'from-green-500 to-emerald-500' : 'from-blue-500 to-cyan-500'} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 flex-shrink-0`}>
                          <faq.icon className="w-7 h-7 text-white" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-lg md:text-xl font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                          {faq.question}
                        </CardTitle>
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                        openFaq === index 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white rotate-90' 
                          : 'bg-gray-100 text-gray-400 group-hover:bg-green-100 group-hover:text-green-600'
                      }`}>
                        <ChevronRight className="w-6 h-6 transition-transform" aria-hidden="true" />
                      </div>
                    </div>
                  </CardHeader>
                  {openFaq === index && (
                    <CardContent className="px-6 pb-6 pt-0 animate-in slide-in-from-top-3 duration-300">
                      <div className="pl-[4.5rem] pr-4">
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-green-200 to-transparent mb-5" />
                        <p className="text-base text-gray-700 leading-relaxed font-medium">
                          {faq.answer}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
            
            {/* Additional Help CTA */}
            <div className="mt-16 text-center">
              <Card className="border-2 border-green-200/60 bg-gradient-to-br from-green-50/50 to-emerald-50/50 backdrop-blur-sm shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Headphones className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900">Still have questions?</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                    Our support team is here to help. Get in touch and we'll respond as soon as possible.
                  </p>
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-sm h-12 px-8 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-bold" 
                    asChild
                  >
                    <Link href="/auth/signin">
                      Contact Support
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Simple Design */}
      <footer className="border-t border-green-200/60 py-8 px-4 bg-gradient-to-b from-green-50/30 via-white to-white mt-12">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm text-gray-600 font-semibold mb-2">
              © {new Date().getFullYear()} AfyaSolar. All rights reserved.
            </p>
            <p className="text-xs text-gray-500">
              Empowering healthcare through sustainable energy
            </p>
          </div>
        </div>
      </footer>

      {/* Back to Top Button - Modern Design */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 text-white rounded-2xl shadow-2xl hover:shadow-green-500/50 transition-all hover:scale-110 flex items-center justify-center z-50 group backdrop-blur-sm border-2 border-white/20"
          aria-label="Back to top"
        >
          <ArrowUp className="w-7 h-7 group-hover:-translate-y-1 transition-transform" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
