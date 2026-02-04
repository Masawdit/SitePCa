import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      nextcloudUrl,
      username,
      password,
      folderPath,
      fileName,
      fileContent,  // Base64 encoded
      contentType
    } = await req.json()

    // Validate required fields
    if (!nextcloudUrl || !username || !password || !fileName || !fileContent) {
      throw new Error('Missing required fields')
    }

    // Decode base64 file content
    const binaryString = atob(fileContent)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Ensure folder path starts with /
    const normalizedFolder = folderPath?.startsWith('/') ? folderPath : `/${folderPath || ''}`

    // Build WebDAV URL
    const webdavUrl = `${nextcloudUrl.replace(/\/$/, '')}/remote.php/dav/files/${username}${normalizedFolder}/${fileName}`

    // Upload via WebDAV PUT
    const response = await fetch(webdavUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: bytes
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Nextcloud upload failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return new Response(
      JSON.stringify({ success: true, url: webdavUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
