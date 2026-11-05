package com.nautica.gps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LayersLegendSheet(
    isOpen: Boolean,
    onClose: () -> Unit
) {
    if (!isOpen) return

    ModalBottomSheet(
        onDismissRequest = onClose,
        containerColor = Zinc950,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Zinc700) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Layers, contentDescription = null, tint = RaymarineCyan, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Livelli Carta & Legenda Nautica", color = PureWhite, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, contentDescription = "Chiudi", tint = Zinc400)
                }
            }

            HorizontalDivider(color = Zinc800)

            // INT-1 Symbol Legend
            Text("LEGENDA SIMBOLI NAUTICI (INT-1)", color = Zinc400, fontSize = 11.sp, fontWeight = FontWeight.Bold)

            // Legend item 1: Scoglio
            LegendItem(symbol = "+", symbolColor = RaymarineRed, title = "Scoglio sommerso", desc = "Roccia costantemente sommersa, pericolo chiglia")

            // Legend item 2: Bricola
            LegendItem(symbol = "|||", symbolColor = RaymarineYellow, title = "Bricola (Pali segnacanale)", desc = "Palina in legno per delimitazione canale navigabile")

            // Legend item 3: Boa IALA
            LegendItem(symbol = "▲", symbolColor = RaymarineGreen, title = "Meda / Boa IALA (Verde dritta)", desc = "Segnalamento laterale tribordo diurno e notturno")

            // Legend item 4: Faro
            LegendItem(symbol = "★", symbolColor = RaymarineYellow, title = "Faro / Fanale ottico", desc = "Segnalamento marittimo costiero ad alta portata")

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun LegendItem(symbol: String, symbolColor: androidx.compose.ui.graphics.Color, title: String, desc: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PureBlack, RoundedCornerShape(8.dp))
            .border(1.dp, Zinc900, RoundedCornerShape(8.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .background(symbolColor.copy(alpha = 0.2f), RoundedCornerShape(6.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(symbol, color = symbolColor, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column {
            Text(title, color = PureWhite, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(desc, color = Zinc400, fontSize = 11.sp)
        }
    }
}
