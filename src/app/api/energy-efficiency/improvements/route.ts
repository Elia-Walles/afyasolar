import { NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

export async function POST(req: Request) {
  try {
    const { context } = await req.json()

    if (!context || typeof context !== "string") {
      return NextResponse.json({ error: "Missing context" }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server" },
        { status: 500 },
      )
    }

    const systemPrompt =
      "You are an energy efficiency expert helping health facilities in East Africa improve solar and electricity usage. " +
      "Based on the notes provided, suggest concrete, practical improvements grouped by: Behavioral, Operational, and Technical. " +
      "Write the response as plain text using numbered lists only, without any markdown formatting and without using asterisk (*) characters. " +
      "Keep the answer concise (3–6 items per group) and avoid hallucinating data not mentioned in the notes."

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Updated to a currently supported Groq model
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              "Here are the assessment notes from the Energy Efficiency Assessment Tool. " +
              "Generate tailored improvement recommendations:\n\n" +
              context,
          },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    })

    const text = await response.text()

    if (!response.ok) {
      console.error("Groq API error:", response.status, text)
      return NextResponse.json(
        {
          error: `Groq API error ${response.status}: ${text}`,
        },
        { status: response.status },
      )
    }

    const data = JSON.parse(text)
    const content =
      data?.choices?.[0]?.message?.content ??
      "No recommendations were generated. Please try again with more detailed notes."

    // Ensure no asterisk characters (*) appear in the final response
    const sanitizedContent = typeof content === "string" ? content.replace(/\*/g, "") : content

    return NextResponse.json({ recommendations: sanitizedContent })
  } catch (error) {
    console.error("Error in improvements AI endpoint:", error)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}

