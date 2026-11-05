package com.nautica.gps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.nautica.gps.model.SavedRoute
import com.nautica.gps.ui.theme.*

@Composable
fun SavedRoutesDialog(
    isOpen: Boolean,
    savedRoutes: List<SavedRoute>,
    onClose: () -> Unit,
    onLoadRoute: (SavedRoute, Boolean) -> Unit,
    onDeleteRoute: (String) -> Unit
) {
    if (!isOpen) return

    Dialog(onDismissRequest = onClose) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.75f),
            shape = RoundedCornerShape(16.dp),
            color = Zinc950,
            border = androidx.compose.foundation.BorderStroke(1.dp, Zinc800)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Libreria Rotte Marine (${savedRoutes.size})",
                        color = PureWhite,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, contentDescription = "Chiudi", tint = Zinc400)
                    }
                }

                HorizontalDivider(color = Zinc800, modifier = Modifier.padding(vertical = 8.dp))

                if (savedRoutes.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "Nessuna rotta salvata.\nCrea una rotta sulla mappa e premi 'Salva rotta'.",
                            color = Zinc400,
                            fontSize = 13.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(savedRoutes) { route ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(PureBlack, RoundedCornerShape(8.dp))
                                    .border(1.dp, Zinc800, RoundedCornerShape(8.dp))
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(route.name, color = PureWhite, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    Text(
                                        "${route.points.size} punti",
                                        color = Zinc400,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }

                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    // Load Forward
                                    IconButton(
                                        onClick = { onLoadRoute(route, false); onClose() },
                                        modifier = Modifier.size(32.dp).background(RaymarineYellow, RoundedCornerShape(6.dp))
                                    ) {
                                        Icon(Icons.Default.Navigation, contentDescription = "Naviga", tint = PureBlack, modifier = Modifier.size(16.dp))
                                    }

                                    // Load Reversed
                                    IconButton(
                                        onClick = { onLoadRoute(route, true); onClose() },
                                        modifier = Modifier.size(32.dp).background(Zinc800, RoundedCornerShape(6.dp))
                                    ) {
                                        Icon(Icons.Default.SwapVert, contentDescription = "Inverti rotta", tint = RaymarineCyan, modifier = Modifier.size(16.dp))
                                    }

                                    // Delete
                                    IconButton(
                                        onClick = { onDeleteRoute(route.id) },
                                        modifier = Modifier.size(32.dp).background(RaymarineRed.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = "Elimina", tint = RaymarineRed, modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
