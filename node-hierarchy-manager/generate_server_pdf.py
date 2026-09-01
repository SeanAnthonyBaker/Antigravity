import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "RustDesk Self-Hosted Server Setup & Architecture Guide")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, footer_text)
        self.drawString(54, 36, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Antigravity Infrastructure")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        
        self.restoreState()

def build_pdf(filename="RustDesk_Self_Hosted_Server_Setup_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    PRIMARY = colors.HexColor("#0F172A")     # Slate 900
    SECONDARY = colors.HexColor("#1E293B")   # Slate 800
    ACCENT_BLUE = colors.HexColor("#0284C7") # Sky 600
    SUCCESS_GREEN = colors.HexColor("#16A34A")
    WARNING_AMBER = colors.HexColor("#D97706")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#CBD5E1")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=PRIMARY,
        spaceAfter=3
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12
    )
    
    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=PRIMARY,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=ACCENT_BLUE,
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=SECONDARY,
        spaceAfter=4
    )

    table_header = ParagraphStyle(
        'TH',
        parent=body,
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TC',
        parent=body,
        fontName='Helvetica',
        fontSize=8,
        leading=11
    )

    table_cell_code = ParagraphStyle(
        'TCC',
        parent=body,
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        textColor=PRIMARY
    )

    story = []

    # Title Banner
    story.append(Paragraph("RustDesk Self-Hosted Server Setup &amp; Architecture Guide", title_style))
    story.append(Paragraph("Deployment, Key Pair Encryption, Port Configurations, and Client Pairing", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT_BLUE, spaceBefore=0, spaceAfter=10))

    # Executive Overview Box
    summary_data = [
        [Paragraph("<b>Server Architecture:</b>", body), Paragraph("Dual-Daemon: <b>hbbs</b> (ID/Rendezvous Server) + <b>hbbr</b> (Relay Server)", body)],
        [Paragraph("<b>Workspace Directory:</b>", body), Paragraph("<code>rustdesk-server/</code> (docker-compose.yml &amp; manage_server.ps1)", table_cell_code)],
        [Paragraph("<b>Local Server IP:</b>", body), Paragraph("<b>192.168.1.128</b> (Configurable for public WAN/DDNS domain)", body)],
        [Paragraph("<b>Security &amp; Encryption:</b>", body), Paragraph("<b>Ed25519 Private/Public Key Authentication</b> (Blocks unauthorized relay access)", body)]
    ]
    st = Table(summary_data, colWidths=[160, 344])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(st)
    story.append(Spacer(1, 10))

    # Section 1: Architecture & Daemon Functions
    story.append(Paragraph("1. RustDesk Server Components &amp; Port Requirements", h1_style))
    story.append(Paragraph("A self-hosted RustDesk infrastructure uses two core server binaries working in tandem:", body))

    ports_data = [
        [Paragraph("Port / Protocol", table_header), Paragraph("Service Daemon", table_header), Paragraph("Functional Purpose", table_header)],
        [
            Paragraph("<b>21115 (TCP)</b>", table_cell_code),
            Paragraph("<b>hbbs</b>", table_cell),
            Paragraph("NAT type test and rendezvous connection negotiation.", table_cell)
        ],
        [
            Paragraph("<b>21116 (TCP/UDP)</b>", table_cell_code),
            Paragraph("<b>hbbs</b>", table_cell),
            Paragraph("<b>TCP:</b> ID registration &amp; heartbeat. <b>UDP:</b> Heartbeat &amp; hole punching.", table_cell)
        ],
        [
            Paragraph("<b>21117 (TCP)</b>", table_cell_code),
            Paragraph("<b>hbbr</b>", table_cell),
            Paragraph("<b>Relay Service:</b> Relays encrypted screen and input streams when direct P2P is blocked.", table_cell)
        ],
        [
            Paragraph("<b>21118 / 21119 (TCP)</b>", table_cell_code),
            Paragraph("<b>hbbs / hbbr</b>", table_cell),
            Paragraph("Web client WebSocket support (for browser-based remote access).", table_cell)
        ]
    ]
    pt = Table(ports_data, colWidths=[110, 110, 284])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(pt)
    story.append(Spacer(1, 10))

    # Section 2: Deployment Artifacts
    story.append(Paragraph("2. Pre-Configured Files in Your Workspace", h1_style))
    story.append(Paragraph("The server configuration has been prepared directly inside <code>rustdesk-server/</code>:", body))

    files_data = [
        [Paragraph("File Path", table_header), Paragraph("Role &amp; Details", table_header)],
        [
            Paragraph("<b>docker-compose.yml</b>", table_cell_code),
            Paragraph("Orchestrates <code>rustdesk/rustdesk-server:latest</code> for both <code>hbbs</code> and <code>hbbr</code> with persistent volume storage in <code>./data</code> and automatic restart policies.", table_cell)
        ],
        [
            Paragraph("<b>manage_server.ps1</b>", table_cell_code),
            Paragraph("PowerShell script providing one-click commands: <code>start</code>, <code>stop</code>, <code>status</code>, <code>key</code>, and <code>logs</code>.", table_cell)
        ]
    ]
    ft = Table(files_data, colWidths=[150, 354])
    ft.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(ft)
    story.append(Spacer(1, 10))

    # Section 3: Step-by-Step Operations
    story.append(Paragraph("3. Starting the Server &amp; Client Configuration", h1_style))
    
    ops = [
        ("A. Starting the Server", [
            "Ensure Docker Desktop is running on your machine.",
            "Run the management script from PowerShell: <code>.\\rustdesk-server\\manage_server.ps1 start</code>",
            "This spins up both containers and creates the cryptographic key pair (<code>data/id_ed25519</code> and <code>data/id_ed25519.pub</code>)."
        ]),
        ("B. Retrieving Your Public Encryption Key", [
            "Run <code>.\\rustdesk-server\\manage_server.ps1 key</code> to view the generated public key.",
            "The <code>-k _</code> flag in your docker compose configuration ensures only clients holding this key can establish connections through your server."
        ]),
        ("C. Configuring RustDesk Clients (Desktop &amp; Mobile)", [
            "On any computer or phone running RustDesk, click the <b>3-dot menu</b> next to ID &gt; <b>Network / ID/Relay Server</b>.",
            "Enter the following fields:",
            "• <b>ID Server:</b> <code>192.168.1.128:21116</code> (or your external DDNS domain if accessing from outside LAN)",
            "• <b>Relay Server:</b> <code>192.168.1.128:21117</code> (or your external DDNS domain)",
            "• <b>Key:</b> Paste the contents of your <code>id_ed25519.pub</code> key file.",
            "Click <b>OK</b>. The status indicator in RustDesk will turn <b>Ready (Green)</b> connected to your private server."
        ])
    ]

    for title, substeps in ops:
        story.append(Paragraph(f"<b>{title}</b>", h2_style))
        for s in substeps:
            story.append(Paragraph(f"• {s}", body))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 6))
    story.append(Paragraph("4. Remote WAN / Internet Access (Optional)", h1_style))
    story.append(Paragraph(
        "To connect to your server from outside your home/office network (over the public Internet), forward ports <b>21115 (TCP)</b>, <b>21116 (TCP/UDP)</b>, and <b>21117 (TCP)</b> on your home router to <b>192.168.1.128</b>, or connect via Tailscale/VPN.",
        body
    ))

    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    out_file = os.path.abspath("RustDesk_Self_Hosted_Server_Setup_Guide.pdf")
    build_pdf(out_file)
    print("SUCCESS: " + out_file)
