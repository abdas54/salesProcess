sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "com/eros/salesprocess/model/formatter",
    "sap/m/BusyDialog",
    "sap/m/PlacementType",
    "sap/ndc/BarcodeScanner",
    "com/eros/salesprocess/lib/epos-2.27.0"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, MessageToast, Fragment, MessageBox, formatter, BusyDialog, PlacementType, BarcodeScanner, epson2) {
        "use strict";
        var that;
        return Controller.extend("com.eros.salesprocess.controller.MainView", {
            formatter: formatter,
            onInit: function () {
                that = this;
                $("body").css("zoom", "90%");


                this.token = 0;
                this.oModel = this.getOwnerComponent().getModel();
                this.oModel.setSizeLimit(1000);
                this.customerModel = this.getOwnerComponent().getModel("customerService");
                this.getView().setModel(this.customerModel, "CustomerModel");

                this.productModel = new JSONModel({ Product: [], MaterialCode: "" });
                this.getView().setModel(this.productModel, "ProductModel");

                this.backupProdArr = [];

                that.stockModel = new JSONModel({ Product: [], inpMatCode: "" });
                that.getView().setModel(that.stockModel, "StockModel");

                that.homeDelModel = new JSONModel({ Product: [] });
                that.getView().setModel(that.homeDelModel, "HomeDelModel");

                that.customerAddressModel = new JSONModel();
                this.getView().setModel(this.customerAddressModel, "custAddModel");

                this.getView().byId("page").setVisible(false);

                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": ""
                });
                this.getView().setModel(showSection, "ShowSection");

                var model1 = new JSONModel();
                model1.setData({
                    "selectedMode": ""
                });
                this.getView().setModel(model1, "ShowCardsSection");

                var model2 = new JSONModel();
                model2.setData({
                    "selectedMode": ""
                });
                this.getView().setModel(model2, "ShowCurrencySection");

                var model3 = new JSONModel();
                model3.setData({
                    "selectedMode": "",
                    "cardPaymentMode": 0
                });
                this.getView().setModel(model3, "ShowPaymentSection");

                var model4 = new JSONModel();
                model4.setData({
                    "selectedMode": "Item List",

                });
                this.getView().setModel(model4, "ShowDiscountSection");

                //this._openSalesmanDialog();
                this.validateLoggedInUser();
                this.aEntries = [];
                this.aEntries1 = [];
                this.aPaymentEntries = [];
                this.serialNumbers = [];
                this.masterSerialNumber = [];
                this.emiList = []
                this.emiID = 0;
                this.paymentId = 0;
                this.sourceIdCounter = 0;
                this.paymentEntSourceCounter = 0;
                this.shippingMethod = "";
                this.suspendComments = "";
                this.openStockTile = false;
                this.cashierID = "";
                this.CashierPwd = "";

            },

            validateLoggedInUser: function () {
                var that = this;
                this.oModel.read("/StoreIDSet", {
                    success: function (oData) {
                        that.storeID = oData.results[0] ? oData.results[0].Store : "";
                        that.plantID = oData.results[0] ? oData.results[0].Plant : "";
                        that.onPressPayments();
                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {
                                    window.history.go(-1);
                                }
                            }
                        });
                    }
                });
            },
            getManualMatDetail: function (oEvent) {
                this.getMaterialDetail(true, oEvent.getParameter("value"));
            },
            getMaterialDetail: function (flag, matCode, data, promo, promoData) {
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, matCode));
                if (data !== "") {
                    aFilters.push(new sap.ui.model.Filter("Plant", sap.ui.model.FilterOperator.EQ, data.getProperty("Plant")));
                    aFilters.push(new sap.ui.model.Filter("Location", sap.ui.model.FilterOperator.EQ, data.getProperty("Location")));
                }


                this.oModel.read("/MaterialSet", {
                    urlParameters: {
                        "$expand": "ToDiscounts"
                    },
                    filters: aFilters,
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            oData.results[0].SaleQuantity = 1;
                            oData.results[0].HomeDelivery = false;
                            oData.results[0].NetAmount = oData.results[0].GrossPrice;
                            oData.results[0].Seq = "";
                            oData.results[0].SalesmanId = "";
                            oData.results[0].SalesmanName = "";
                            that.reservedItemOwnLocation(oData.results, promo, promoData);


                        }

                    },
                    error: function (oError) {
                        aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                        if (JSON.parse(oError.responseText).error.message.code === "MATERIAL_CHECK") {
                            sap.m.MessageBox.show(
                                "Item is not available at this store location. Do you want to check other locations?", {
                                icon: sap.m.MessageBox.Icon.INFORMATION,
                                title: "Availability Check",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {
                                    if (oAction === "OK") {
                                        that.getMaterialAllLocation(aFilters);
                                    } else {

                                    }
                                }
                            }
                            );
                        }
                        else {
                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );
                        }

                    }
                });
            },
            getMaterialAllLocation: function (aFilters) {
                this.oModel.read("/MaterialSet", {
                    urlParameters: {
                        "$expand": "ToDiscounts"
                    },
                    filters: aFilters,
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            for (var count = 0; count < oData.results.length; count++) {
                                oData.results[count].SaleQuantity = 1;
                                oData.results[count].HomeDelivery = true;
                                oData.results[count].NetAmount = oData.results[count].GrossPrice;
                                oData.results[count].Seq = "";
                                oData.results[count].SalesmanId = "";
                                oData.results[count].SalesmanName = "";
                            }

                            that.stockGlobalModel = new JSONModel({ Product: [] });
                            that.getView().setModel(that.stockGlobalModel, "StockGlobalModel");
                            var aProducts = that.getView().getModel("StockGlobalModel").getProperty("/Product");
                            aProducts.push(...oData.results);
                            that.getView().getModel("StockGlobalModel").setProperty("/Product", aProducts);
                            that.getView().getModel("StockGlobalModel").setProperty("/MaterialCode", "");
                            if (!that.openStockTile) {
                                if (!that._oDialogGlobalStock) {
                                    Fragment.load({
                                        name: "com.eros.salesprocess.fragment.stockAllLocationAvailability",
                                        controller: that
                                    }).then(function (oFragment) {
                                        that._oDialogGlobalStock = oFragment;
                                        that.getView().addDependent(that._oDialogGlobalStock);
                                        that._oDialogGlobalStock.open();
                                    }.bind(that));
                                } else {
                                    that._oDialogGlobalStock.open();
                                }
                            }

                        }

                    },
                    error: function (oError) {

                        sap.m.MessageBox.show(
                            JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {

                            }
                        }
                        );


                    }
                });
            },
            onDelete: function (oEvent) {
                var oTable = this.getView().byId("idProductsTable");
                var oModel = this.getView().getModel("ProductModel"); // Get the JSON model
                var aProducts = oModel.getProperty("/Product"); // Get the array from the model

                // Get the selected item from the event
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("ProductModel");

                if (oModel.getObject(oContext.sPath).ToDiscounts) {

                    if (oModel.getObject(oContext.sPath).ToDiscounts.results.length > 0) {
                        var aData = oModel.getObject(oContext.sPath).ToDiscounts.results;
                        var selectedItemCode = oModel.getObject(oContext.sPath).Itemcode;
                        var hasBundleDiscount = aData.some(function (oRow) {
                            return oRow.ConditionName === "BUNDLE ALL DISCOUNT";
                        });
                        var keyFound = "";
                        if (hasBundleDiscount) {
                            for (var key in this._appliedPromotions) {
                                var arr = this._appliedPromotions[key];
                                if (arr.some(item => item.Material === selectedItemCode)) {
                                    keyFound = key;
                                    break;
                                }
                            }
                            var productMatch = aProducts.find(p => p.Itemcode === keyFound);

                            if (productMatch) {
                                sap.m.MessageBox.error("This Item is part of Bundle All Promotion. Kindly delete the Parent Item to delete this item.");
                            } else {
                                this.deleteItemReservation(oModel.getObject(oContext.sPath), oContext);
                            }

                        }
                        else {
                            if (this._appliedPromotions) {
                                var aData = oModel.getObject(oContext.sPath).ToDiscounts.results;
                                var selectedItemCode = oModel.getObject(oContext.sPath).Itemcode;

                                for (let key in this._appliedPromotions) {
                                    if (this._appliedPromotions[key].Material === selectedItemCode) {
                                        delete this._appliedPromotions[key];
                                    }
                                }
                            }
                            this.deleteItemReservation(oModel.getObject(oContext.sPath), oContext);
                        }

                    }
                    else {
                        this.deleteItemReservation(oModel.getObject(oContext.sPath), oContext);
                    }
                }
                else {
                    this.deleteItemReservation(oModel.getObject(oContext.sPath), oContext);
                }






            },
            deleteItemReservation: function (data, oContext) {
                var oModel = this.getView().getModel("ProductModel"); // Get the JSON model
                var aProducts = oModel.getProperty("/Product");
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "D",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {
                        if (oContext) {
                            that.serialNumbers = that.serialNumbers.filter(function (entry) {
                                return entry.itemCode !== data.Itemcode;
                            });

                            var iIndex = oContext.getPath().split("/").pop(); // Extract index
                            var delItemCode = that.getView().getModel("ProductModel").getProperty("/Product/" + iIndex).Itemcode;
                            aProducts.splice(iIndex, 1); // Remove the item from array
                            that.updateSeq(aProducts);
                            if (that.getView().getModel("ProductModel").getProperty("/Product").length > 0) {
                                that.checkEnableDisableTile(true);
                            }
                            else {
                                that.checkEnableDisableTile(false);
                            }
                            that.updateDiscountTable(delItemCode, data);
                            //oModel.setProperty("/Product", aProducts); // Update the model
                            oModel.refresh(); // Refresh UI binding
                        }
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Deleting the item");
                    }
                });


            },
            updateDiscountTable: function (itemCode, data) {
                var oModel = this.getView().getModel("discountModelTable");
                if (oModel) {
                    var oData = oModel.getData(); // returns { entries: [...] }
                    var aEntries = oData.entries;

                    // Define the ItemCode to remove
                    var sItemCodeToRemove = itemCode; // Replace with dynamic value as needed

                    // Filter out the entry with matching ItemCode
                    var aFiltered = aEntries.filter(function (entry) {
                        return entry.ItemCode !== sItemCodeToRemove;
                    });

                    // Update the model
                    oModel.setProperty("/entries", aFiltered);
                    this.aEntries1 = that.aEntries1.filter(function (entry) {
                        return entry.ItemCode !== itemCode;
                    });


                }
                if (data.PromotionFlag === "X") {
                    this.parentItemCode = itemCode;
                    this.checkPromotionItem(itemCode);
                }

                if (this.deletingPromoItem) {

                    this.checkPromotionItem(this.parentItemCode);
                }


            },
            checkPromotionItem: function (itemCode) {
                var oTable = this.byId("idProductsTable");

                //this._appliedPromotions = this._appliedPromotions || {};
                //this.aMaterials = Object.values(this._appliedPromotions);
                this._tempPromotion = this._appliedPromotions[itemCode] ? this._appliedPromotions[itemCode] : this._tempPromotion;
                this.aMaterials = this._tempPromotion;


                if (this.aMaterials.length === undefined) {
                    this.aMaterials = [this.aMaterials];
                }
                var aItemCodes = Object.keys(this._appliedPromotions);

                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");



                for (var count = productTblData.length - 1; count >= 0; count--) {


                    for (var count1 = 0; count1 < this.aMaterials.length; count1++) {

                        // if (this.aMaterials[0][count1]) {
                        //     if (this.aMaterials[0][count1].Material === productTblData[count].Itemcode) {
                        //         this.deletingPromoItem = true;
                        //         var oItemToDelete = oTable.getItems()[count];

                        //         if (that._appliedPromotions[itemCode]) {
                        //             that._appliedPromotions[itemCode] = that._appliedPromotions[itemCode].filter(function (entry) {
                        //                 return entry.Material !== productTblData[count].Itemcode;
                        //             });


                        //         }

                        //         oTable.fireDelete({ listItem: oItemToDelete });

                        //     }

                        // }
                        if (this.aMaterials[count1].Material === productTblData[count].Itemcode) {
                            this.deletingPromoItem = true;
                            var oItemToDelete = oTable.getItems()[count];
                            if (this._tempPromotion.length === undefined) {
                                this._tempPromotion = [this._tempPromotion].filter(
                                    promo => promo.Material !== this.aMaterials[count1].Material
                                );

                            }
                            else {
                                this._tempPromotion = this._tempPromotion.filter(
                                    promo => promo.Material !== this.aMaterials[count1].Material
                                );
                            }
                            oTable.fireDelete({ listItem: oItemToDelete });
                        }

                    }
                    if (count === 0) {
                        delete this._appliedPromotions[itemCode];
                    }

                }










            },
            onPressCurrency: function () {
                var model = new JSONModel();
                model.setData({
                    "selectedMode": "CurrencyView"
                });
                this.getView().setModel(model, "ShowCurrencySection");
            },
            _openSalesmanDialog: function () {
                if (!this._oDialog) {
                    Fragment.load({
                        id: this.getView().getId(),
                        name: "com.eroserospos.Fragment.SalesmanDialog",
                        controller: this
                    }).then(function (oDialog) {
                        this._oDialog = oDialog;
                        this.getView().addDependent(this._oDialog);
                        this._oDialog.open();
                    }.bind(this));
                } else {
                    this._oDialog.open();
                }
            },
            // onDialogClose: function () {
            //     this.getView().byId("page").setVisible(true);
            // },
            onDialogConfirm: function () {
                var sInputValue = this.byId("salesmanInput").getValue();
                if (sInputValue.trim()) {
                    MessageToast.show("Salesman ID/Name entered: " + sInputValue);
                    this._oDialog.close();
                    this.getView().byId("page").setVisible(true);
                } else {
                    MessageToast.show("Please enter Salesman ID/Name!");
                }
            },

            onInputChange: function (oEvent) {
                // Optional: Perform live validation if needed
                var sValue = oEvent.getParameter("value");
                console.log("Current Input: ", sValue);
            },

            onHoldBill: function () {
                MessageToast.show("Bill is on hold!");
            },

            onVoidAll: function () {
                MessageToast.show("All items voided!");
            },

            onVoidLine: function () {
                MessageToast.show("Selected line voided!");
            },

            onPriceCheck: function () {
                MessageToast.show("Price checked!");
            },
            getStockDetail: function (flag, matCode) {
                var aFilters = [];


                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, matCode));

                aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                this.oModel.read("/MaterialSet", {
                    urlParameters: {
                        "$expand": "ToDiscounts"
                    },
                    filters: aFilters,
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            that.stockModel = new JSONModel({ Product: [] });
                            that.getView().setModel(that.stockModel, "StockModel");
                            var aProducts = that.getView().getModel("StockModel").getProperty("/Product");
                            aProducts.push(...oData.results);
                            that.getView().getModel("StockModel").setProperty("/Product", aProducts);
                            //that.onOpenFragment();

                        }
                        else {
                            sap.m.MessageBox.show(
                                "No Item found", {
                                icon: sap.m.MessageBox.Icon.INFORMATION,
                                title: "Stock Availability Check",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {
                                    if (oAction === "OK") {

                                    } else {

                                    }
                                }
                            }
                            );
                        }
                        console.log("Success", oData);
                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(
                            JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {

                            }
                        }
                        );
                    }
                });
            },
            // onScanSuccessStock: function (oEvent) {
            //     if (oEvent.getParameter("cancelled")) {
            //         MessageToast.show("Scan cancelled", { duration: 1000 });
            //     } else {
            //         if (oEvent.getParameter("text")) {
            //             this.getStockDetail(false, oEvent.getParameter("text"));

            //         }
            //     }
            // },
            // onScanErrorOne: function (oEvent) {
            //     MessageToast.show("Scan Failed");
            // },
            getStockDetailManually: function (oEvent) {
                this.getStockDetail(true, oEvent.getParameter("value"));
            },


            onStockAvailability: function () {
                this.openStockTile = true;
                that.stockModel = new JSONModel({ Product: [], inpMatCode: "" });
                that.getView().setModel(that.stockModel, "StockModel");
                this.onOpenFragment();
            },
            onOpenFragment: function () {
                if (!this._oDialogStock) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.stockAvailability",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogStock = oFragment;
                        this.getView().addDependent(this._oDialogStock);
                        this._oDialogStock.open();
                    }.bind(this));
                } else {
                    this._oDialogStock.open();
                }

            },
            onPressOkButton: function () {
                this.openStockTile = false;
                this._oDialogStock.close();
            },
            onCustomerLink: function () {
                var customerData = {
                    FirstName: "John",
                    LastName: "Doe",
                    PhoneNumber: "1234567890",
                    DateOfBirth: "1990-01-01",
                    HomeAddress: "123 Main St, Hometown",
                    DeliveryAddress: "456 Delivery Ln, City"
                };
                var oCustomerModel = new JSONModel(customerData);
                this.getView().setModel(oCustomerModel, "CustomerModel");
                if (!this._oDialogCustomer) {
                    Fragment.load({
                        name: "com.eroserospos.Fragment.customerData",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogCustomer = oFragment;
                        this.getView().addDependent(this._oDialogCustomer);
                        this._oDialogCustomer.open();
                    }.bind(this));
                } else {
                    this._oDialogCustomer.open();
                }
            },
            onPressCustomerButton: function () {
                this._oDialogCustomer.close();
            },
            onPressDiscount: function () {
                var selectedItem = this.getView().byId("idProductsTable").getSelectedItem();
                if (!selectedItem) {
                    var oModel = new sap.ui.model.json.JSONModel({
                        "ItemCode": "",
                        "ConditionType": "",
                        "Reason": "",
                        "Amount": "",
                        "Authority": "",

                    });
                    this.getView().setModel(oModel, "discountModel");
                    if (!this._oDialogDiscount) {
                        Fragment.load({
                            name: "com.eros.salesprocess.fragment.discount",
                            controller: this
                        }).then(function (oFragment) {
                            this._oDialogDiscount = oFragment;
                            this.getView().addDependent(this._oDialogDiscount);
                            this._oDialogDiscount.open();
                        }.bind(this));
                    } else {
                        this._oDialogDiscount.open();
                    }
                }
                else {
                    MessageToast.show("Select Item to apply for Manual Discount");
                }


            },
            onCloseManualDiscount: function () {
                this._oDialogDiscount.close();
            },
            onSelectItemCode: function (oEvent) {
                this.sItemDescription = oEvent.getParameter("selectedItem").getProperty("text");
                // var oComboBox = oEvent.getParameter("value");
                // var oProductModel = this.getView().getModel("ProductModel");
                // var aProducts = oProductModel.getProperty("/Product");
                // var oMatchedItem = aProducts.find(obj => obj.Itemcode === oComboBox);
                // var description = ""

                // if (oMatchedItem) {
                //     description= oMatchedItem.Description;
                //     } else {
                //         description = ""; // or return null, or "Unknown"
                // }
                this.getView().getModel("discountModel").setProperty("/ItemDescription", this.sItemDescription);
            },
            onAddManualDiscount: function () {
                var oView = this.getView();
                var oModel = oView.getModel("discountModel");
                var sItemCode = oModel.getProperty("/ItemCode");
                var sReason = oModel.getProperty("/Reason");
                var sType = oModel.getProperty("/ConditionType");
                var sAmount = oModel.getProperty("/Amount");
                var sAuthority = oModel.getProperty("/Authority");


                var duplicate = false;

                if (!sReason || !sType || !sAmount || !sAuthority || !sItemCode) {
                    MessageToast.show("Please fill all fields.");
                    return;
                }

                if (this.aEntries.length > 0) {

                    for (var count = 0; count < this.aEntries.length; count++) {
                        if (this.aEntries[count].ItemCode === sItemCode && this.aEntries[count].Type === sType) {
                            duplicate = true;
                            break;
                        }
                    }
                }

                if (!duplicate) {
                    this.aEntries.push({
                        ItemCode: sItemCode,
                        ItemDescription: this.sItemDescription,
                        Reason: sReason,
                        Type: sType,
                        Amount: sAmount,
                        Authority: sAuthority,
                        ConditionName: this.sConditionName,
                        DiscountType: "M"

                    });

                    var oModel1 = new sap.ui.model.json.JSONModel();
                    oModel1.setData({ "entries": this.aEntries });
                    this.getView().setModel(oModel1, "discountModelTbl");

                    oModel.setProperty("/ItemCode", "");
                    oModel.setProperty("/Reason", "");
                    oModel.setProperty("/ConditionType", "");
                    oModel.setProperty("/Amount", "");
                    oModel.setProperty("/Authority", "");
                    oModel.setProperty("/ItemDescription", "");
                    oModel.refresh();
                }
                else {
                    MessageBox.error("Same Discount has been already applied. Kindly Delete the existing record to add new Discount");
                }

            },
            onSelectConditionType: function (oEvent) {
                this.sConditionName = oEvent.getParameter("selectedItem").getProperty("text");
            },
            onDeleteManualPayment: function (oEvent) {
                var oModel = this.getView().getModel("ShowPaymentSection"); // Get the JSON model
                var aEntries = oModel.getProperty("/allEntries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("ShowPaymentSection");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop();
                aEntries.splice(iIndex, 1);
                //this.aPaymentEntries.splice(iIndex,1);
                var balanceAmount = "";
                if (dataObj.PaymentType === "CASH") {
                    var totSalBal = sap.ui.getCore().byId("totalSaleBalText").getText();
                    balanceAmount = parseFloat(dataObj.Amount) + parseFloat(totSalBal)
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(balanceAmount).toFixed(2));
                    this.getView().getModel("ShowPaymentSection").setProperty("/allEntries", this.aPaymentEntries)
                    this.getView().getModel("ShowPaymentSection").refresh();
                }
                else if (dataObj.PaymentType === "BOUNZ") {
                    sap.m.MessageBox.INFORMATION("Bounz Payment cannot be deleted");
                }
                else if (dataObj.PaymentType === "NEGV") {
                    sap.m.MessageBox.INFORMATION("NEGV Payment cannot be deleted");
                }
                else {
                    this.deRedeemVoucher(dataObj);
                }

            },
            deRedeemVoucher: function (dataObj) {
                var balanceAmount = "";
                var that = this;
                var data = {
                    "PaymentType": dataObj.PaymentType,
                    "Amount": dataObj.Amount,
                    "VoucherNumber": dataObj.VoucherNumber
                }
                this.oModel.create("/PaymentMethodsSet", data, {
                    success: function (oData, response) {
                        var totSalBal = sap.ui.getCore().byId("totalSaleBalText").getText();
                        balanceAmount = parseFloat(dataObj.Amount) + parseFloat(totSalBal)
                        sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(balanceAmount).toFixed(2));
                        that.getView().getModel("ShowPaymentSection").setProperty("/allEntries", that.aPaymentEntries)
                        that.getView().getModel("ShowPaymentSection").refresh();

                    },
                    error: function (oError) {


                    }
                });

            },
            onDeleteManualDiscount: function (oEvent) {
                var bflag = false;
                var oModel = this.getView().getModel("discountModelTbl"); // Get the JSON model
                var aEntries = oModel.getProperty("/entries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("discountModelTbl");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop(); // Extract index
                var matchProdTableIndex = -1;
                var matchDiscTableIndex = -1;
                aEntries.splice(iIndex, 1);
                oModel.refresh();
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");
                for (var count = 0; count < productTblData.length; count++) {
                    var discountData = productTblData[count].ToDiscounts.results;
                    for (var count2 = 0; count2 < discountData.length; count2++) {

                        if (dataObj.ItemCode === discountData[count2].ItemCode && dataObj.ConditionName === discountData[count2].ConditionName && dataObj.DiscountType === "M") {
                            bflag = true;
                            matchProdTableIndex = count;
                            matchDiscTableIndex = count2;
                            break;
                        }
                    }
                }
                if (bflag) {
                    this.removeManualDiscount(matchProdTableIndex, productTblData[matchProdTableIndex], dataObj);
                    this.getView().getModel("ProductModel").getProperty("/Product")[matchProdTableIndex].ToDiscounts.results.splice(matchDiscTableIndex, 1);
                }
            },
            onPressDiscountButton: function () {
                this._oDialogDiscount.close();

            },
            onApplyManualDiscount: function () {
                var discountTblData = this.getView().getModel("discountModelTbl").getProperty("/entries");
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < productTblData.length; count++) {

                    for (var count1 = 0; count1 < discountTblData.length; count1++) {
                        if (discountTblData[count1].ItemCode === productTblData[count].Itemcode) {
                            var bflag = false;
                            for (var count2 = 0; count2 < productTblData[count].ToDiscounts.results.length; count2++) {
                                var dataObj = productTblData[count].ToDiscounts.results;
                                if (dataObj[count2].ItemCode === discountTblData[count1].ItemCode && dataObj[count2].ConditionName === discountTblData[count1].ConditionName) {
                                    bflag = true;
                                    break;
                                }

                            }
                            if (!bflag) {
                                productTblData[count].ToDiscounts.results.push({
                                    "ConditionAmount": "-" + discountTblData[count1].Amount,
                                    "ConditionId": this.retrieveConditionId(productTblData[count]),
                                    "ConditionName": discountTblData[count1].ConditionName,
                                    "ConditionType": discountTblData[count1].Type,
                                    "Currency": "AED",
                                    "DiscountType": "M",
                                    "ItemCode": discountTblData[count1].ItemCode,
                                    "ModifierType": "D",
                                    "Remarks": discountTblData[count1].Reason,
                                    "Authority": discountTblData[count1].Authority

                                })
                                this.updateProductTable(count, productTblData[count], discountTblData[count1]);
                            }
                        }
                    }
                }
                this._oDialogDiscount.close();

            },
            retrieveConditionId: function (productTableData) {
                var itemDiscountCondition = productTableData.ToDiscounts.results;
                var incConditionId = "";
                var conditionId = "";
                if (itemDiscountCondition.length > 0) {
                    conditionId = itemDiscountCondition[itemDiscountCondition.length - 1].ConditionId;
                    incConditionId = parseInt(conditionId) + 1;
                    return incConditionId.toString();
                }
                else {
                    incConditionId = 1;
                    return incConditionId.toString();
                }



            },
            updateProductTable: function (count, productTblData, discountTblData, promo) {
                var that = this;
                var selIndex = count;
                var updatedNetAmount = "";
                var updateDiscount = "";
                if (discountTblData.Type === "ZSUS") {
                    updateDiscount = parseFloat(parseFloat((productTblData.Discount)) + parseFloat((discountTblData.Amount))).toFixed(2);

                }
                else {
                    updateDiscount = parseFloat(parseFloat(productTblData.Discount).toFixed(2) - parseFloat(discountTblData.Amount).toFixed(2)).toFixed(2);
                }

                if (promo) {
                    updateDiscount = parseFloat(parseFloat(productTblData.Discount) + parseFloat(discountTblData.Amount)).toFixed(2);
                }
                that.bPromoItem = false;

                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).Discount = updateDiscount;
                if (parseInt(productTblData.SaleQuantity) === 1) {
                    updatedNetAmount = parseFloat(parseFloat(productTblData.UnitPrice) + parseFloat(updateDiscount)).toFixed(2);
                    //this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(updatedNetAmount).toFixed(2);
                    var vatAmount = parseFloat(updatedNetAmount * (productTblData.VatPercent) / 100).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(parseFloat(vatAmount) + parseFloat(updatedNetAmount)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);

                }
                else {
                    updatedNetAmount = parseFloat(productTblData.UnitPrice).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(updatedNetAmount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    var netAmount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                    var netDiscount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                    var vatPercent = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent

                    //this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                    this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                    this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                }

                this.getView().getModel("ProductModel").refresh();
                this.setHeaderData();



            },
            removeManualDiscount: function (count, productTblData, discountTblData) {
                var selIndex = count;
                var updatedNetAmount = "";

                var updateDiscount = "";
                if (discountTblData.Type === "ZSUS") {
                    updateDiscount = parseFloat(parseFloat((productTblData.Discount)) - parseFloat((discountTblData.Amount))).toFixed(2);

                }
                else {
                    updateDiscount = parseFloat(parseFloat(productTblData.Discount) + parseFloat(discountTblData.Amount)).toFixed(2);
                }
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).Discount = updateDiscount;

                if (parseInt(productTblData.SaleQuantity) === 1) {
                    updatedNetAmount = parseFloat(parseFloat(productTblData.UnitPrice) + parseFloat(updateDiscount)).toFixed(2);
                    // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(updatedNetAmount).toFixed(2);
                    //var vatAmount = parseFloat(parseInt(updatedNetAmount) * (parseInt(parseFloat(productTblData.VatPercent).toFixed(2)) / 100)).toFixed(2);
                    var vatAmount = parseFloat(updatedNetAmount * productTblData.VatPercent / 100).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(parseFloat(vatAmount) + parseFloat(updatedNetAmount)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);

                }
                else {
                    updatedNetAmount = parseFloat(productTblData.UnitPrice).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(updatedNetAmount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(updateDiscount).toFixed(2) * parseFloat(productTblData.SaleQuantity).toFixed(2)).toFixed(2);
                    var netAmount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                    var netDiscount = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                    var vatPercent = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                    //this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                    this.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                    this.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                }
                this.getView().getModel("ProductModel").refresh();
                this.setHeaderData();
            },

            onDiscountTypeSelect: function (oEvent) {
                var oSelectedButton = oEvent.getParameter("selectedIndex");
                // var sKey = oSelectedButton.data("key");
                var oItemLevelVBox = sap.ui.getCore().byId("itemLevelDiscountVBox");

                if (oSelectedButton === 1) {
                    oItemLevelVBox.setVisible(true);
                } else {
                    oItemLevelVBox.setVisible(false);
                }
            },
            onPressPayments: function () {
                if (!this._oDialogCashier) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.cashier",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogCashier = oFragment;
                        this.getView().addDependent(this._oDialogCashier);
                        this._oDialogCashier.open();
                    }.bind(this));
                } else {
                    this._oDialogCashier.open();
                }
            },
            fnCloseCashier: function () {
                this._oDialogCashier.close();
            },
            enableValidateBtn: function (oEvent) {
                if (oEvent.getSource().getId() === "cashId") {
                    this.cashierID = oEvent.getSource().getValue();
                }
                else if (oEvent.getSource().getId() === "casPwd") {
                    this.CashierPwd = oEvent.getSource().getValue();
                }


                if (this.cashierID.length > 0 && this.CashierPwd.length > 0) {
                    sap.ui.getCore().byId("validatebtn").setEnabled(true);
                }
                else {
                    sap.ui.getCore().byId("validatebtn").setEnabled(false);
                }
            },
            fnValidateCashier: function (oEvent) {
                var that = this;
                that.getView().byId("page").setVisible(false);
                var empId = oEvent.getSource().getParent().getContent()[0].getItems()[0].getContent()[1].getValue();
                var pwd = oEvent.getSource().getParent().getContent()[0].getItems()[0].getContent()[3].getValue();
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Etype", sap.ui.model.FilterOperator.EQ, "C"));
                aFilters.push(new sap.ui.model.Filter("EmployeeId", sap.ui.model.FilterOperator.EQ, empId));
                aFilters.push(new sap.ui.model.Filter("SecretCode", sap.ui.model.FilterOperator.EQ, pwd));
                aFilters.push(new sap.ui.model.Filter("Generate", sap.ui.model.FilterOperator.EQ, "Y"));

                //EmployeeSet?$filter=Etype eq 'C' and EmployeeId eq '112' and SecretCode eq 'Abc#91234'

                this.oModel.read("/EmployeeSet", {
                    filters: aFilters,
                    success: function (oData) {
                        that.cashierID = oData.results[0] ? oData.results[0].EmployeeId : "";
                        that.cashierName = oData.results[0] ? oData.results[0].EmployeeName : "";
                        that._oDialogCashier.close();
                        that.getView().byId("cashier").setCount(oData.results[0].EmployeeName);
                        that.getView().byId("tranNumber").setCount(oData.results[0].TransactionId);
                        that.getView().byId("page").setVisible(true);

                    },
                    error: function (oError) {
                        that.getView().byId("page").setVisible(false);
                        if (JSON.parse(oError.responseText).error.code === "CASHIER_CHECK") {
                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Cashier Validation",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );
                        }
                        else {
                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );
                        }
                        console.error("Error", oError);
                    }
                });

            },
            validCustomer: function () {
                var entered = this.getView().byId("customer").getCount();
                if (entered) {
                    return true;
                }
                else {
                    return false
                }

            },
            validSerial: function () {
                var oProductModel = this.getView().getModel("ProductModel");
                var aProductData = oProductModel.getProperty("/Product");

                // Initialize an empty array
                var aItemCodesWithSerialFlagY = [];

                // Loop through the data
                if (aProductData && Array.isArray(aProductData)) {
                    aProductData.forEach(function (oItem) {
                        if (oItem.SerialFlag === "Y" && !oItem.HomeDelivery) {
                            aItemCodesWithSerialFlagY.push(oItem.Itemcode);
                        }
                    });
                }

                var bAllSerialsExist = aItemCodesWithSerialFlagY.every(function (sItemCode) {
                    return this.serialNumbers.some(function (oSerial) {
                        return oSerial.itemCode === sItemCode && oSerial.serialNumber && oSerial.serialNumber.trim() !== "";
                    });
                }.bind(this));

                return bAllSerialsExist;

            },
            onCheckSaleAmounts: function () {
                var that = this;
                var oModel = this.getView().getModel("ProductModel");
                var aProducts = oModel.getProperty("/Product");
                this.aNegativeItems = [];

                aProducts.forEach(function (oItem) {
                    if (oItem.SaleAmount < 0) {
                        that.aNegativeItems.push(oItem.Itemcode);
                    }
                });

                if (this.aNegativeItems.length > 0) {

                    return false;
                } else {
                    return true;
                }
            },

            onPressPayments1: function () {
                var that = this;
                var checkCustomer = this.validCustomer();
                var checkSerial = this.validSerial();
                var discountAmount = this.onCheckSaleAmounts();
                var checkHomeDelivery = this.checkHomeDelivery();
                var chckSalesman = this.checkSalesman();
                var custData = this.getView().getModel("custAddModel").getData();
                var homeDelivery = true;
                var paidAmount = 0;
                var balanceAmount = "";
                var saleAmount = "";
                if (checkHomeDelivery === "HD") {
                    if (custData.shippingDate === undefined || custData.shippingDate === null || custData.ShippingInst === undefined || custData.ShippingInst === null) {
                        homeDelivery = false;
                    }
                }
                if (checkCustomer && checkSerial && discountAmount && homeDelivery && chckSalesman) {
                    var oModel = new sap.ui.model.json.JSONModel({
                        totalAmount: "0.00",
                        paymentOptions: [{
                            option: "Cash",
                            icon: "sap-icon://wallet"
                        }, {
                            option: "Card",
                            icon: "sap-icon://credit-card"
                        }, {
                            option: "CreditNote",
                            icon: "sap-icon://commission-check"
                        }, {
                            option: "Advance Payment",
                            icon: "sap-icon://batch-payments"
                        }, {
                            option: "Gift Voucher",
                            icon: "sap-icon://money-bills"
                        }, {
                            option: "Non-GV",
                            icon: "sap-icon://money-bills"
                        },
                        {
                            option: "Bounze",
                            icon: "sap-icon://chain-link"
                        },
                        {
                            option: "View All Records",
                            icon: "sap-icon://sum"
                        }]

                        // {
                        //     option: "Forex",
                        //     icon : "sap-icon://currency"
                        // }
                    });
                    this.getView().setModel(oModel, "PaymentModel");

                    var cashData = [{
                        denomination: "",
                        qty: 0,
                        total: 0
                    }];

                    var oModel1 = new JSONModel({
                        "cashData": cashData,
                        "grandTotal": 0
                    });
                    this.getView().setModel(oModel1, "CashModel");

                    if (!that._oDialogPayment) {
                        Fragment.load({
                            name: "com.eros.salesprocess.fragment.payment",
                            controller: that
                        }).then(function (oFragment) {
                            that._oDialogPayment = oFragment;
                            that.getView().addDependent(that._oDialogPayment);
                            that.getView().getModel("ShowPaymentSection").setProperty("/selectedMode", "");
                            sap.ui.getCore().byId("cashSbmtBtn").setEnabled(true);
                            sap.ui.getCore().byId("totalAmountText").setText(that.getView().byId("saleAmount").getCount());
                            saleAmount = that.getView().byId("saleAmount").getCount();
                            for (var count2 = 0; count2 < that.aPaymentEntries.length; count2++) {
                                paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count2].Amount) + parseFloat(paidAmount)).toFixed(2);

                            }
                            balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                            sap.ui.getCore().byId("totalSaleBalText").setText(balanceAmount);
                            that._oDialogPayment.open();
                            that._oDialogCashier.close();
                        }.bind(that));
                    } else {
                        that.getView().getModel("ShowPaymentSection").setProperty("/selectedMode", "");
                        sap.ui.getCore().byId("cashSbmtBtn").setEnabled(true);
                        sap.ui.getCore().byId("totalAmountText").setText(that.getView().byId("saleAmount").getCount());
                        saleAmount = that.getView().byId("saleAmount").getCount();
                        for (var count1 = 0; count1 < that.aPaymentEntries.length; count1++) {
                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        sap.ui.getCore().byId("totalSaleBalText").setText(balanceAmount);
                        that._oDialogPayment.open();
                        that._oDialogCashier.close();
                    }
                }
                else {

                    if (!checkCustomer) {
                        MessageBox.error("Kindly enter Customer Details");

                    }
                    else if (!checkSerial) {
                        MessageBox.error("Kindly make sure to enter Serial Number for the item you have added");
                    }
                    else if (!discountAmount) {
                        MessageBox.error("Following Item Codes have negative Sale Amount:\n" + this.aNegativeItems.join(", "));
                    }
                    else if (!homeDelivery) {
                        MessageBox.error("Kindly make sure to enter Shipping Instruction and Date for Home Delivery Item");
                    }
                    else if (!chckSalesman) {
                        MessageBox.error("Following Item Codes does not have Salesman :\n" + this.aMissingSalesmanItems.join(", "));
                    }
                }
            },
            checkSalesman: function () {
                var that = this;
                var oTable = this.byId("idProductsTable");
                var aItems = oTable.getItems();
                var oModel = this.getView().getModel("ProductModel");
                this.aMissingSalesmanItems = [];
                aItems.forEach(function (oItem) {
                    var oContext = oItem.getBindingContext("ProductModel");
                    var oData = oContext.getObject();

                    if (!oData.SalesmanId || oData.SalesmanId.trim() === "") {
                        that.aMissingSalesmanItems.push(oData.Itemcode);
                    }
                });
                if (that.aMissingSalesmanItems.length > 0) {
                    return false;
                }
                else {
                    return true;
                }

            },
            onPressDiscount1: function () {
                var oModel = new sap.ui.model.json.JSONModel({

                    DiscountList: [{
                        option: "Item List",
                        icon: "sap-icon://activities"
                    }, {
                        option: "Discounts Condition",
                        icon: "sap-icon://blank-tag-2"
                    }, {
                        option: "Reason Type",
                        icon: "sap-icon://cause"
                    }, {
                        option: "Authority",
                        icon: "sap-icon://employee"
                    }, {
                        option: "Amount",
                        icon: "sap-icon://money-bills"
                    }, {
                        option: "View All Records",
                        icon: "sap-icon://sum"
                    }]
                });
                this.getView().setModel(oModel, "DiscountModel");

                var oModel1 = new sap.ui.model.json.JSONModel();
                this.getView().setModel(oModel1, "DiscountValue");



                if (!this._oDialogDiscoun1) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.discount1",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogDiscoun1 = oFragment;
                        this.getView().addDependent(this._oDialogDiscoun1);
                        this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Item List");
                        this._oDialogDiscoun1.open();

                    }.bind(this));
                } else {
                    this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Item List");
                    this._oDialogDiscoun1.open();

                }
            },
            onAddRow: function () {
                var oModel = this.getView().getModel("CashModel");
                var cashData = oModel.getProperty("/cashData");

                cashData.push({
                    denomination: "",
                    qty: 0,
                    total: 0
                });

                oModel.setProperty("/cashData", cashData);
            },
            onDeleteRow: function (oEvent) {
                var oModel = this.getView().getModel("CashModel");
                var cashData = oModel.getProperty("/cashData");

                var oItem = oEvent.getSource().getParent();
                var oList = oItem.getParent();
                var index = oList.indexOfItem(oItem);

                cashData.splice(index, 1);

                oModel.setProperty("/cashData", cashData);

            },
            onOptionSelect: function (oEvent) {
                var sSelectedOption = oEvent.getSource().getProperty("header"); //    oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption
                });
                this.getView().setModel(showSection, "ShowSection");
                //	sap.m.MessageToast.show("Selected: " + sSelectedOption);
            },
            onDiscountSectSelected: function (oEvent) {
                var sSelectedOption = oEvent.getSource().getProperty("header"); //oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption,

                });
                this.getView().setModel(showSection, "ShowDiscountSection");

                if (sSelectedOption === "View All Records") {
                    this.addDiscount();
                }
            },
            onOptionSelectPayment: function (oEvent) {
                var that = this;
                var sSelectedOption = oEvent.getSource().getProperty("header"); // oEvent.getSource().getTitle();
                var showSection = new JSONModel();
                showSection.setData({
                    "selectedMode": sSelectedOption,
                    "cardPaymentMode": 0
                });
                if (sSelectedOption === "Cash") {
                    var cashModel = new JSONModel();
                    cashModel.setData({
                        "cash": [
                            {
                                "title": "1000",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "500",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "200",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "100",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "50",
                                "subtitle": "sap-icon://credit-card"
                            },
                            {
                                "title": "20",
                                "subtitle": "sap-icon://credit-card"
                            }


                        ]
                    })
                }
                this.getView().setModel(cashModel, "cashCurrencyModel");
                this.getView().setModel(showSection, "ShowPaymentSection");
                if (this.getView().getModel("AdvancePayment")) {
                    this.getView().getModel("AdvancePayment").setData({});
                    sap.ui.getCore().byId("advncePaymentList").setVisible(false);
                    sap.ui.getCore().byId("advPayment").setValue("");
                }
                if (this.getView().getModel("GiftVoucher")) {
                    this.getView().getModel("GiftVoucher").setData({});
                    sap.ui.getCore().byId("gvPaymentList").setVisible(false);
                    sap.ui.getCore().byId("giftVoucher").setValue("");
                }
                if (this.getView().getModel("CreditNote")) {
                    this.getView().getModel("CreditNote").setData({});
                    sap.ui.getCore().byId("creditNoteList").setVisible(false);
                    sap.ui.getCore().byId("creditNote").setValue("");

                }
                if (sSelectedOption === "View All Records") {
                    this.getView().getModel("ShowPaymentSection").setProperty("/allEntries", this.aPaymentEntries)
                }
                if (sSelectedOption === "Bounze") {
                    that.bcode = this.getView().getModel("custAddModel").getData().Code;
                    that.bphnNumber = this.getView().getModel("custAddModel").getData().Mobile;
                    sap.ui.getCore().byId("bounzeCustNumber").setValue(that.bcode + " - " + that.bphnNumber);
                    sap.ui.getCore().byId("registerBounz").setEnabled(false);
                    sap.ui.getCore().byId("bounzeDetails").setVisible(false);
                }
            },
            onPressCard: function () {
                var model = new JSONModel();
                model.setData({
                    "selectedMode": "CardsView"
                });
                this.getView().setModel(model, "ShowCardsSection");
            },
            onPressClose: function () {
                this._oDialogPayment.close();
            },
            onPrintTransaction: function () {
                window.print();
            },
            onPressCustData: function () {
                var oModel = new sap.ui.model.json.JSONModel({
                    customerData: [{
                        option: "Basic Information",
                        icon: "sap-icon://add-contact"
                    }, {
                        option: "Customer Address",
                        icon: "sap-icon://database"
                    }, {
                        option: "Shipping Instruction",
                        icon: "sap-icon://shipping-status"
                    }
                    ]
                });
                this.getView().setModel(oModel, "CustModel");





                if (!this._oDialogCust) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.customer",
                        controller: this
                    }).then(function (oFragment) {
                        this._oDialogCust = oFragment;
                        this.getView().addDependent(this._oDialogCust);
                        this._oDialogCust.open();
                    }.bind(this));
                } else {
                    this._oDialogCust.open();
                }

            },
            onAfterRendering: function () {
                var oTable = this.getView().byId("idProductsTable");
                if (oTable) {
                    setTimeout(function () {
                        oTable.$().find(".sapMListTblHeader").css({
                            "background-color": "#A9A9A9",
                            "color": "white"
                        });
                    }, 500); // Delayed execution ensures correct rendering
                }
            },

            onPressCustClose: function () {
                this._oDialogCust.close();
            },
            onPressCustSaveClose: function () {
                this.shippingAddress = "";
                this.shippingDate = "";
                this.shippingInst = "";
                this.deliveryInstruction = "";

                var custData = this.getView().getModel("custAddModel").getData();
                var bFlag = this.validateCustomer();
                var addressParts = [];
                var customerName = [];

                if (custData.ShippingMethod === 0) {
                    this.shippingMethod = "HD";
                } else if (custData.ShippingMethod === 1) {
                    this.shippingMethod = "HP";
                } else if (custData.ShippingMethod === 2) {
                    this.shippingMethod = "PC";
                }
                else if (custData.ShippingMethod === 3) {
                    this.shippingMethod = "MD";
                }
                else if (custData.ShippingMethod === 4) {
                    this.shippingMethod = "WM";
                }
                else if (custData.ShippingMethod === 5) {
                    this.shippingMethod = "DW";
                }
                else if (custData.ShippingMethod === 6) {
                    this.shippingMethod = "HC";
                }
                else if (custData.ShippingMethod === 7) {
                    this.shippingMethod = "AI";
                }

                if (custData.FirstName) {
                    customerName.push(custData.FirstName);
                }
                if (custData.LastName) {
                    customerName.push(custData.LastName);
                }
                var custName = customerName.join(" ");
                this.getView().byId("customer").setCount(custName);
                var selAddIndex = sap.ui.getCore().byId("addressRbGrp").getSelectedIndex();
                if (selAddIndex === 0) {

                    if (custData.HomeAddressLine1) {
                        addressParts.push(custData.HomeAddressLine1);
                    }
                    if (custData.HomeAddressLine2) {
                        addressParts.push(custData.HomeAddressLine2);
                    }
                    if (custData.HomeStreet) {
                        addressParts.push(custData.HomeStreet);
                    }
                    if (custData.HomeCity) {
                        addressParts.push(custData.HomeCity);
                    }
                    if (custData.HomeCountry) {
                        addressParts.push(custData.HomeCountry);
                    }

                }
                else if (selAddIndex === 1) {

                    if (custData.OfficeAddressLine1) {
                        addressParts.push(custData.OfficeAddressLine1);
                    }
                    if (custData.OfficeAddressLine2) {
                        addressParts.push(custData.OfficeAddressLine2);
                    }
                    if (custData.OfficeStreet) {
                        addressParts.push(custData.OfficeStreet);
                    }
                    if (custData.off_City) {
                        addressParts.push(custData.OfficeCity);
                    }
                    if (custData.off_Country) {
                        addressParts.push(custData.OfficeCountry);
                    }



                } else {

                    if (custData.OtherAddressLine1) {
                        addressParts.push(custData.OtherAddressLine1);
                    }
                    if (custData.OtherAddressLine2) {
                        addressParts.push(custData.OtherAddressLine2);
                    }
                    if (custData.oth_po) {
                        addressParts.push(custData.OtherStreet);
                    }
                    if (custData.oth_City) {
                        addressParts.push(custData.OtherCity);
                    }
                    if (custData.oth_Country) {
                        addressParts.push(custData.OtherCountry);
                    }



                }
                this.shippingAddress = addressParts.join(" ");



                if (custData.shippingDate) {
                    var date = new Date(custData.shippingDate);
                    var pad = (n) => String(n).padStart(2, '0');
                    // this.shippingDate = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
                    this.shippingDate = custData.shippingDate;
                }

                if (custData.ShippingInst) {
                    this.shippingInst = custData.ShippingInst;
                }

                this.deliveryInstruction = this.capturePanelData();

                if (bFlag) {
                    this.updateCustomer();
                }

                // this._oDialogCust.close();

            },
            capturePanelData: function () {

                var sResult = "";

                // get all panels
                var aPanels = [
                    sap.ui.getCore().byId("wm"),
                    sap.ui.getCore().byId("dw"),
                    sap.ui.getCore().byId("hc"),
                    sap.ui.getCore().byId("ai"),
                    sap.ui.getCore().byId("hp")
                ];

                // find the visible panel
                var oActivePanel = aPanels.find(function (oPanel) {
                    return oPanel.getVisible();
                });

                if (!oActivePanel) {
                    return;
                }

                // get all items inside the VBox of that panel
                var aItems = oActivePanel.getContent()[0].getItems();

                var sLabel = "";
                var aCheckboxGroup = [];         // store checkboxes under the same label

                // helper function to save collected checkboxes
                var flushCheckboxGroup = function () {
                    if (sLabel && aCheckboxGroup.length > 0) {
                        sResult += sLabel + ": " + aCheckboxGroup.join(", ") + ", ";
                        aCheckboxGroup = []; // reset for next group
                    }
                };
                aItems.forEach(function (oItem) {
                    // Label
                    if (oItem.isA("sap.m.Label")) {
                        flushCheckboxGroup();
                        sLabel = oItem.getText();
                    }

                    // RadioButtonGroup
                    else if (oItem.isA("sap.m.RadioButtonGroup")) {
                        flushCheckboxGroup();
                        var iIndex = oItem.getSelectedIndex();
                        if (iIndex > -1) {
                            var sSelected = oItem.getButtons()[iIndex].getText();
                            sResult += sLabel + ": " + sSelected + ", ";
                        }
                    }

                    // Input
                    else if (oItem.isA("sap.m.Input")) {
                        flushCheckboxGroup();
                        sResult += sLabel + ": " + oItem.getValue() + ", ";
                    }

                    // CheckBox
                    else if (oItem.isA("sap.m.CheckBox")) {

                        if (oItem.getSelected()) {
                            aCheckboxGroup.push(oItem.getText());
                        }
                    }
                });

                // flush at end in case last control was a checkbox
                flushCheckboxGroup();

                // remove last comma
                if (sResult.endsWith(", ")) {
                    sResult = sResult.slice(0, -2);
                }

                console.log("Final Captured Data:", sResult);

                return sResult; // you can store this in your model or backend
            },

            validateCustomer: function () {
                var bFlag;
                var checkDelivery = this.checkHomeDelivery();
                var custData = this.getView().getModel("custAddModel").getData();
                var errorMessage = "";

                // Basic Required Fields
                if (!custData.Mobile || custData.Mobile.trim() === "") {
                    errorMessage += "Mobile Number is required.\n";
                }

                if (!custData.FirstName || custData.FirstName.trim() === "") {
                    errorMessage += "First Name is required.\n";
                }
                if (!custData.Code || custData.Code.trim() === "") {
                    errorMessage += "Country Code is required.\n";
                }
                if (!custData.Mobile || custData.Mobile.trim() === "") {
                    errorMessage += "Mobile Number is required.\n";
                }
                if (!custData.CustomerType || custData.CustomerType.trim() === "") {
                    errorMessage += "Customer Type is required.\n";
                }

                // Additional fields for Tourist (CustType === "2")


                if (checkDelivery === "HD") {
                    if (!custData.shippingDate || custData.shippingDate === "") {
                        errorMessage += "Shipping Date is required for Home Delivery.\n";
                    }
                    if (!custData.ShippingInst || custData.ShippingInst.trim() === "") {
                        errorMessage += "Shipping Instruction is required for Home Delivery.\n";
                    }
                }

                // Show message if there are errors
                if (errorMessage.length > 0) {
                    sap.m.MessageBox.error(errorMessage);
                    bFlag = false;
                }
                else {
                    bFlag = true;
                }

                return bFlag;


            },
            updateCustomer: function () {
                var that = this;
                var data = this.getView().getModel("custAddModel").getData();

                var shippingDate = data.shippingDate;
                var shipingInst = data.ShippingInst;
                var shipingMethod = data.ShippingMethod;
                delete (data.shippingDate);
                delete (data.ShippingInst);
                delete (data.ShippingMethod);

                var birthDate = sap.ui.getCore().byId("birthDate").getValue();


                if (birthDate) {
                    data.BirthDate = new Date(this.resolveTimeDifference(new Date(birthDate)));
                }
                else {
                    data.BirthDate = null;
                }

                data.IdentityExpiry = null;

                this.oModel.create("/CustomerSet", data, {
                    success: function (oData, response) {
                        that.getView().getModel("custAddModel").setData({});
                        that.getView().getModel("custAddModel").setData(oData);
                        that.getView().getModel("custAddModel").setProperty("/shippingDate", shippingDate);
                        that.getView().getModel("custAddModel").setProperty("/ShippingInst", shipingInst);
                        that.getView().getModel("custAddModel").setProperty("/ShippingMethod", shipingMethod);
                        that._oDialogCust.close();
                        sap.m.MessageToast.show("Customer Update Successfully");
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error while Updating Customer");

                    }
                });

            },
            onPressTender: function (oEvent) {
                var oMultiInput = sap.ui.getCore().byId("multiInput");

                var oToken = new sap.m.Token({
                    key: this.token.toString() + "_" + oEvent.getParameter("srcControl").getAggregation("items")[0].getProperty("text"),
                    text: oEvent.getParameter("srcControl").getAggregation("items")[0].getProperty("text")
                });

                this.token++;
                oMultiInput.addToken(oToken);
            },
            onSubtract: function (oEvent) {
                this.getView().setBusy(false);
                var event = oEvent.getSource();
                var oTable = this.getView().byId("idProductsTable");
                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                var balanceStock = selIndexData.Balancestock;
                var qtyValue = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                var iValue = parseInt(qtyValue, 10) || 0;
                if (iValue > 0) {
                    oEvent.getSource().getEventingParent().getItems()[1].setValue(iValue - 1);
                    var itemQty = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                    if (parseInt(itemQty) !== 0) {

                        var that = this;
                        var oPayload = {
                            "TransactionId": this.getView().byId("tranNumber").getCount(),
                            "ReservedFlag": "I",
                            "Material": selIndexData.Itemcode,
                            "Plant": selIndexData.Plant,
                            "Location": selIndexData.Location,
                            "ReservationNo": "",
                            "Type": "",
                            "Status": "",
                            "Quantity": selIndexData.SaleQuantity.toString()

                        }
                        this.oModel.create("/ReservationSet", oPayload, {
                            success: function (oData) {
                                that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                                that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                                var netAmount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                                var netDiscount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                                var vatPercent = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                                // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                                that.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                                that.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                                that.getView().setBusy(false);
                            },
                            error: function (oError) {
                                that.getView().setBusy(false);
                                sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                                    icon: sap.m.MessageBox.Icon.Error,
                                    title: "Error",
                                    actions: [MessageBox.Action.OK],
                                    onClose: function (oAction) {
                                        if (oAction === MessageBox.Action.OK) {
                                            event.getEventingParent().getItems()[1].setValue(1);
                                            event.getEventingParent().getItems()[1].getSource().fireChange();
                                        }
                                    }
                                });
                            }
                        });




                    } else {
                        sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                            {
                                actions: ["OK", "CANCEL"],
                                onClose: function (sAction) {
                                    if (sAction === "OK") {
                                        var oItemToDelete = oTable.getItems()[selIndex];
                                        oTable.fireDelete({ listItem: oItemToDelete });
                                    }
                                    else {
                                        event.getEventingParent().getItems()[1].setValue(1);
                                        event.getEventingParent().getItems()[1].getSource().fireChange();
                                    }
                                }
                            })
                    }

                }

            },
            onManualChangeQty: function (oEvent) {
                this.getView().setBusy(true);
                var event = oEvent.getSource();
                var oTable = this.getView().byId("idProductsTable");
                var qty = oEvent.getParameter("newValue");
                var selIndex = oEvent.getSource().getParent().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                var balanceStock = selIndexData.Balancestock;

                if (!qty) {
                    qty = selIndexData.SaleQuantity.toString();
                }

                if ((qty !== "0")) {


                    var that = this;
                    var oPayload = {
                        "TransactionId": this.getView().byId("tranNumber").getCount(),
                        "ReservedFlag": "I",
                        "Material": selIndexData.Itemcode,
                        "Plant": selIndexData.Plant,
                        "Location": selIndexData.Location,
                        "ReservationNo": "",
                        "Type": "",
                        "Status": "",
                        "Quantity": selIndexData.SaleQuantity.toString()

                    }
                    this.oModel.create("/ReservationSet", oPayload, {
                        success: function (oData) {
                            var qtyValue = qty;
                            var iValue = parseInt(qtyValue, 10) || 0;
                            selIndexData.NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(iValue).toFixed(2)).toFixed(2);
                            selIndexData.NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(iValue).toFixed(2)).toFixed(2);

                            var netAmount = selIndexData.NetAmount;
                            var netDiscount = selIndexData.NetDiscount
                            var vatPercent = selIndexData.VatPercent
                            // selIndexData.NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                            that.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                            that.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                            that.getView().setBusy(false);
                        },
                        error: function (oError) {
                            that.getView().setBusy(false);
                            sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: [MessageBox.Action.OK],
                                onClose: function (oAction) {
                                    if (oAction === MessageBox.Action.OK) {
                                        if (JSON.parse(oError.responseText).error.message.value) {
                                            var resrveQty = parseInt(JSON.parse(oError.responseText).error.message.value.split(":")[1]);
                                            event.setValue(resrveQty);
                                            event.fireChange();
                                        }

                                    }
                                }
                            });
                        }
                    });



                }
                else {
                    sap.m.MessageBox.confirm("Do you want to delete the Item, press Ok to Continue or Cancel",
                        {
                            title: "Confirmation",
                            actions: ["OK", "CANCEL"],
                            onClose: function (sAction) {
                                if (sAction === "OK") {
                                    var oItemToDelete = oTable.getItems()[selIndex];
                                    oTable.fireDelete({ listItem: oItemToDelete });
                                }
                                else {
                                    event.setValue(1);
                                    event.fireChange();
                                }


                            }
                        }
                    );
                }


            },
            onAddition: function (oEvent) {
                this.getView().setBusy(true);
                var that = this;
                var event = oEvent;
                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                this.oControl = oEvent.getSource().getEventingParent().getItems()[1];
                var qtyValue = oEvent.getSource().getEventingParent().getItems()[1].getValue();
                var balanceStock = selIndexData.Balancestock;
                var iValue = parseInt(qtyValue, 10) || 0;
                oEvent.getSource().getEventingParent().getItems()[1].setValue(iValue + 1);
                var itemQty = oEvent.getSource().getEventingParent().getItems()[1].getValue();

                //this.reservedItemonAdditnSub(selIndexData, "add");
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": selIndexData.Itemcode,
                    "Plant": selIndexData.Plant,
                    "Location": selIndexData.Location,
                    "ReservationNo": "",
                    "Type": "",
                    "Status": "",
                    "Quantity": selIndexData.SaleQuantity.toString()

                }
                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {
                        that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount = parseFloat(parseFloat(selIndexData.UnitPrice).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);
                        that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount = parseFloat(parseFloat(selIndexData.Discount).toFixed(2) * parseFloat(itemQty).toFixed(2)).toFixed(2);

                        var netAmount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount;
                        var netDiscount = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetDiscount
                        var vatPercent = that.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatPercent
                        // this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).NetAmount= parseFloat(parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                        that.calculateVATAmount(netAmount, netDiscount, vatPercent, selIndex);
                        that.calculateSalesAmount(netAmount, netDiscount, vatPercent, selIndex);
                        that.getView().setBusy(false);
                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {
                                    that.oControl.setValue(qtyValue);
                                    that.oControl.getSource().fireChange();
                                }
                            }
                        });
                    }
                });




            },
            calculateSalesAmount: function (netAmount, netDiscount, vatPercent, selIndex) {

                var netPrice = (parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).SaleAmount = parseFloat(vatAmount) + parseFloat(netPrice);
                this.getView().getModel("ProductModel").refresh();
            },
            calculateVATAmount: function (netAmount, netDiscount, vatPercent, selIndex) {
                var netPrice = (parseFloat(netAmount) + parseFloat(netDiscount)).toFixed(2);
                var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
                this.getView().getModel("ProductModel").getObject("/Product/" + selIndex).VatAmount = vatAmount;
                this.getView().getModel("ProductModel").refresh();

            },
            formatVatAmount: function (unitPrice, unitDiscount, vatPercent, vatAmount, seq) {

                if (parseFloat(vatAmount).toFixed(2) === "0.00") {
                    var netPrice = (parseFloat(unitPrice) + parseFloat(unitDiscount)).toFixed(2);
                    var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).VatAmount = vatAmount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).NetDiscount = unitDiscount;
                    this.getView().getModel("ProductModel").refresh();

                    return vatAmount;
                }
                else {

                    return vatAmount;
                }

            },
            formatSalesAmount: function (unitPrice, unitDiscount, vatPercent, vatAmount, salesAmount, seq) {

                if (parseFloat(salesAmount).toFixed(2) === "0.00") {
                    var netPrice = (parseFloat(unitPrice) + parseFloat(unitDiscount)).toFixed(2);
                    var vatAmount = parseFloat(netPrice * vatPercent / 100).toFixed(2);
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).NetDiscount = unitDiscount;
                    this.getView().getModel("ProductModel").getObject("/Product/" + (seq / 10 - 1)).SaleAmount = parseFloat(parseFloat(vatAmount) + parseFloat(netPrice)).toFixed(2);
                    this.getView().getModel("ProductModel").refresh();
                    this.setHeaderData();
                    return parseFloat(parseFloat(vatAmount) + parseFloat(netPrice)).toFixed(2);

                }
                else {

                    this.setHeaderData();
                    return parseFloat(salesAmount).toFixed(2);
                }

            },
            setHeaderData: function () {
                var items = that.getView().getModel("ProductModel").getProperty("/Product");
                var totalQty = 0;
                var totalAmount = 0;
                var totalDiscount = 0;
                var totalVAT = 0;
                var totalSaleAmount = 0;

                for (var count = 0; count < items.length; count++) {

                    totalQty = totalQty + parseFloat(items[count].SaleQuantity);
                    totalVAT = parseFloat(parseFloat(totalVAT) + parseFloat(items[count].VatAmount)).toFixed(2);
                    totalSaleAmount = parseFloat(parseFloat(totalSaleAmount) + parseFloat(items[count].SaleAmount)).toFixed(2);
                    totalAmount = parseFloat(parseFloat(totalAmount) + parseFloat(items[count].NetAmount)).toFixed(2);
                    totalDiscount = parseFloat(parseFloat(totalDiscount) + parseFloat(items[count].NetDiscount)).toFixed(2);

                }

                this.getView().byId("qty").setCount(totalQty);
                this.getView().byId("gross").setCount(totalAmount);
                this.getView().byId("discount").setCount(totalDiscount);
                this.getView().byId("vat").setCount(totalVAT);
                this.getView().byId("saleAmount").setCount(totalSaleAmount);

            },
            OnSignaturePress: function () {
                var that = this,
                    oView = this.getView();
                if (!this._pAddRecordDialog) {
                    this._pAddRecordDialog = Fragment.load({
                        id: oView.getId(),
                        name: "com.eros.salesprocess.fragment.signaturePad",
                        controller: this,
                    }).then(function (oValueHelpDialog) {
                        oView.addDependent(oValueHelpDialog);
                        return oValueHelpDialog;
                    });
                }

                this._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        //    that.onClear();
                        oValueHelpDialog.open();
                    }.bind(that)
                );
            },
            onClear: function () {
                sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").clear();
                sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePadCash").clear();
                // sap.ui.core.Fragment.byId(this.getView().getId(), "idName").setValue("");
                // sap.ui.core.Fragment.byId(this.getView().getId(), "idStaff").setValue("");
                // sap.ui.core.Fragment.byId(this.getView().getId(), "idComments").setValue("");
            },
            onDialogClose: function () {
                //this.onClear();
                this._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        oValueHelpDialog.close();
                    }.bind(this)
                );



            },
            onPressAddButton: function (oEvent) {
                var oTable = oEvent.getSource().getParent().getContent()[0].getItems()[0];
                var sPath = oTable.getSelectedContextPaths();
                var itemData = that.getView().getModel("StockGlobalModel").getObject(sPath[0]);

                if (parseInt(itemData.Balancestock) > 0) {
                    this.reservedItemGlobalLocation(itemData);
                    that._oDialogGlobalStock.close();
                }
                else {
                    MessageBox.error("No Stock is available for this Location. Kindly select other location");
                }

            },
            onPressCloseStock: function () {
                that._oDialogGlobalStock.close();
            },
            openAllLocationMatInfo: function (oEvent) {
                var that = this;
                var event = oEvent;
                that.switch = oEvent.getSource();
                var oTable = this.getView().byId("idProductsTable");
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                this.sPathOpenAllLocation = oEvent.getSource().getParent().oBindingContexts.ProductModel.sPath;
                var itemData = that.getView().getModel("ProductModel").getObject(this.sPathOpenAllLocation);
                var aFilters = [];
                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, itemData.Itemcode));
                if (oEvent.mParameters.state) {
                    aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                }

                if (oEvent.mParameters.state) {
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {
                                for (var count = 0; count < oData.results.length; count++) {
                                    oData.results[count].SaleQuantity = 1;
                                    oData.results[count].HomeDelivery = true;
                                    oData.results[count].NetAmount = oData.results[count].NetPrice;
                                }
                                that.homeDelModel = new JSONModel({ Product: [] });
                                that.getView().setModel(that.homeDelModel, "HomeDelModel");
                                var aProducts = that.getView().getModel("HomeDelModel").getProperty("/Product");
                                aProducts.push(...oData.results);
                                that.getView().getModel("HomeDelModel").setProperty("/Product", aProducts);
                                if (!that._oHomeDelMat) {
                                    Fragment.load({
                                        name: "com.eros.salesprocess.fragment.homeDeliveryMaterial",
                                        controller: that
                                    }).then(function (oFragment) {
                                        that._oHomeDelMat = oFragment;
                                        that.getView().addDependent(that._oHomeDelMat);
                                        that._oHomeDelMat.open();
                                    }.bind(that));
                                } else {
                                    that._oHomeDelMat.open();
                                }


                            }

                        },
                        error: function (oError) {

                            sap.m.MessageBox.show(
                                JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: ["OK", "CANCEL"],
                                onClose: function (oAction) {

                                }
                            }
                            );

                        }
                    });
                }
                else {
                    sap.m.MessageBox.confirm("Item will get deleted from the list. You have to add it again, press Ok to Continue or Cancel",
                        {
                            actions: ["OK", "CANCEL"],
                            onClose: function (sAction) {
                                if (sAction === "OK") {
                                    var oItemToDelete = oTable.getItems()[that.sPathOpenAllLocation.split("/Product/")[1]];
                                    oTable.fireDelete({ listItem: oItemToDelete });
                                }
                                else {
                                    that.switch.setState(true);
                                }
                            }
                        })
                    // this.oModel.read("/MaterialSet", {
                    //     urlParameters: {
                    //         "$expand": "ToDiscounts"
                    //     },
                    //     filters: aFilters,
                    //     success: function (oData) {
                    //         if (oData.results.length > 0) {
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).Location = oData.results[0].Location;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).LocationName = oData.results[0].LocationName;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).SaleQuantity = 1;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).NetPrice = oData.results[0].NetPrice;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).Discount = oData.results[0].Discount;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).Plant = oData.results[0].Plant;
                    //             that.getView().getModel("ProductModel").getObject(that.sPathOpenAllLocation).NetAmount = parseFloat(parseFloat(oData.results[0].NetPrice).toFixed(2) * parseFloat(1).toFixed(2)).toFixed(2);
                    //             that.getView().getModel("ProductModel").refresh(true);
                    //         }

                    //     },
                    //     error: function (oError) {

                    //         sap.m.MessageBox.show(
                    //             JSON.parse(oError.responseText).error.message.value, {
                    //             icon: sap.m.MessageBox.Icon.Error,
                    //             title: "Error",
                    //             actions: ["OK", "CANCEL"],
                    //             onClose: function (oAction) {
                    //                 that.switch.setState(true);
                    //             }
                    //         }
                    //         );

                    //     }
                    // });
                }
            },
            onSelectHomeDelivery: function (oEvent) {

                var itemData = this.getView().getModel("ProductModel").getObject(this.sPathOpenAllLocation);
                var homeDelData = this.getView().getModel("HomeDelModel").getObject(oEvent.getSource().getParent().getContent()[0].getItems()[0].getSelectedContextPaths()[0]);
                this.removeReservation(itemData);
                itemData.Location = homeDelData.Location;
                itemData.LocationName = homeDelData.LocationName;
                itemData.Plant = homeDelData.Plant;

                this.reservedItemonHomeDel(homeDelData);
                this.getView().getModel("ProductModel").refresh();
                that._oHomeDelMat.close();
            },
            removeReservation: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "D",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {
                        sap.m.MessageToast.show("Reservation of Existing Item has been removed");


                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error in Deleting the Reserving of the item");
                    }
                });
            },
            reservedItemonHomeDel: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                        var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                        var bFlag = false;
                        for (var count = 0; count < tableData.length; count++) {

                            if ((tableData[count].Itemcode === data.Itemcode) && (tableData[count].Location === data.Location)) {
                                if (table[count]) {
                                    data.Seq = table[count].Seq;
                                }
                                tableData[count] = {};
                                tableData[count] = data;
                                bFlag = true;
                            }
                        }

                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });
                    }
                });
            },
            onPressCancelHomeDelivery: function () {
                that._oHomeDelMat.close();
                that.switch.setState(false);
            },
            onSuggest: function (oEvent) {
                var that = this;
                this.openMessageBox = false;
                var sValue = "";

                that._lastSuggestTimestamp = Date.now();
                var requestTimestamp = that._lastSuggestTimestamp;

                if (oEvent.getParameter("suggestValue")) {
                    sValue = oEvent.getParameter("suggestValue");
                }
                else if (oEvent.getParameter("value")) {
                    sValue = oEvent.getParameter("value");
                }
                // var oInput = oEvent.getSource();
                // var oSuggestionPopup = oInput._getSuggestionsPopover().getPopover();
                // oSuggestionPopup.setPlacement(PlacementType.Right);
                if (sValue.length > 0) { // Suggest only when user types 3 or more characters
                    var oSuggestionModel = that.getView().getModel("suggestionModel");
                    if (!oSuggestionModel) {
                        oSuggestionModel = new sap.ui.model.json.JSONModel({ suggestions: [] });
                        that.getView().setModel(oSuggestionModel, "suggestionModel");
                    } else {
                        oSuggestionModel.setProperty("/suggestions", []);
                    }
                    var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sValue)];
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {
                                if (requestTimestamp !== that._lastSuggestTimestamp) {
                                    return;
                                }
                                else {
                                    oSuggestionModel.setProperty("/suggestions", oData.results);
                                }

                            }

                        },
                        error: function (oError) {

                            if (JSON.parse(oError.responseText).error.code === "MATERIAL_CHECK") {

                                if (!that.messageBox) {
                                    that.messageBox = sap.m.MessageBox;
                                    that.messageBox.show(
                                        "Item is not available at this store location. Do you want to check other locations?", {
                                        icon: sap.m.MessageBox.Icon.INFORMATION,
                                        title: "Availability Check",
                                        actions: ["OK", "CANCEL"],
                                        onClose: function (oAction) {
                                            if (oAction === "OK") {
                                                that.messageBox = null;
                                                aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                                                that.getMaterialAllLocation(aFilters);


                                            } else {

                                            }
                                        }
                                    }
                                    );
                                }


                            }
                            else {
                                sap.m.MessageBox.show(
                                    JSON.parse(oError.responseText).error.message.value, {
                                    icon: sap.m.MessageBox.Icon.Error,
                                    title: "Error",
                                    actions: ["OK", "CANCEL"],
                                    onClose: function (oAction) {

                                    }
                                }
                                );
                            }
                            console.error("Error", oError);
                        }
                    });

                }
            },
            onStockSuggest: function (oEvent) {
                var that = this;
                this.openMessageBox = false;
                var sValue = "";
                that._lastSuggestTimestamp = Date.now();
                var requestTimestamp = that._lastSuggestTimestamp;
                if (oEvent.getParameter("suggestValue")) {
                    sValue = oEvent.getParameter("suggestValue");
                }
                else if (oEvent.getParameter("value")) {
                    sValue = oEvent.getParameter("value");
                }
                // var oInput = oEvent.getSource();
                // var oSuggestionPopup = oInput._getSuggestionsPopover().getPopover();
                // oSuggestionPopup.setPlacement(PlacementType.Right);
                if (sValue.length > 0) {
                    var oSuggestionModel = that.getView().getModel("suggestionModel");
                    if (!oSuggestionModel) {
                        oSuggestionModel = new sap.ui.model.json.JSONModel({ suggestions: [] });
                        that.getView().setModel(oSuggestionModel, "suggestionModel");
                    } else {
                        oSuggestionModel.setProperty("/suggestions", []);
                    } // Suggest only when user types 3 or more characters
                    var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sValue)];
                    this.oModel.read("/MaterialSet", {
                        urlParameters: {
                            "$expand": "ToDiscounts"
                        },
                        filters: aFilters,
                        success: function (oData) {
                            if (oData.results.length > 0) {

                                if (requestTimestamp !== that._lastSuggestTimestamp) {
                                    return;
                                }
                                else {
                                    oSuggestionModel.setProperty("/suggestions", oData.results);
                                }




                            }

                        },
                        error: function (oError) {
                            aFilters.push(new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.EQ, "X"));
                            if (JSON.parse(oError.responseText).error.code === "MATERIAL_CHECK") {
                                // if (!that.openMessageBox) {
                                //     sap.m.MessageBox.show(
                                //         "Item is not available at this store location. Do you want to check other locations?", {
                                //         icon: sap.m.MessageBox.Icon.INFORMATION,
                                //         title: "Availability Check",
                                //         actions: ["OK", "CANCEL"],
                                //         onClose: function (oAction) {
                                //             if (oAction === "OK") {
                                //                 that.openMessageBox = true;
                                //                 that.getMaterialAllLocation(aFilters);


                                //             } else {

                                //             }
                                //         }
                                //     }
                                //     );
                                // }
                            }
                            else {
                                sap.m.MessageBox.show(
                                    JSON.parse(oError.responseText).error.message.value, {
                                    icon: sap.m.MessageBox.Icon.Error,
                                    title: "Error",
                                    actions: ["OK", "CANCEL"],
                                    onClose: function (oAction) {

                                    }
                                }
                                );
                            }
                            console.error("Error", oError);
                        }
                    });

                }
            },
            onSuggestionSelected: function (oEvent) {
                var that = this;
                var evt = oEvent;
                var oSelectedRow = oEvent.getParameter("selectedRow");
                if (oSelectedRow) {
                    var oContext = oSelectedRow.getBindingContext("suggestionModel");
                    var sItemCode = oContext.getProperty("Itemcode");

                    var sOnHandsStock = oContext.getProperty("Balancestock");

                    if (parseInt(sOnHandsStock) <= 0) {
                        var aFilters = [new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.Contains, sItemCode),
                        new sap.ui.model.Filter("AllLocations", sap.ui.model.FilterOperator.Contains, "X")]
                        sap.m.MessageBox.show(
                            "Item is not available at this store location. Do you want to check other locations?", {
                            icon: sap.m.MessageBox.Icon.INFORMATION,
                            title: "Availability Check",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {
                                if (oAction === "OK") {

                                    that.getMaterialAllLocation(aFilters);


                                } else {

                                }
                            }
                        }
                        );

                    } else {

                        this.getMaterialDetail(true, sItemCode, oContext);
                    }

                }
            },
            onSuggestionStockSelected: function (oEvent) {
                var that = this;
                var oSelectedRow = oEvent.getParameter("selectedRow");
                if (oSelectedRow) {
                    var oContext = oSelectedRow.getBindingContext("suggestionModel");
                    var sItemCode = oContext.getProperty("Itemcode");

                    this.getStockDetail(true, sItemCode);

                }
            },
            reservedItemOwnLocation: function (data, promo, promoData) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data[0].Itemcode,
                    "Plant": data[0].Plant,
                    "Location": data[0].Location,
                    "Quantity": data[0].SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                for (var counter = 0; counter < tableData.length; counter++) {
                    if ((tableData[counter].Itemcode === data[0].Itemcode) && (tableData[counter].Location === data[0].Location)) {
                        oPayload.Quantity = (parseInt(tableData[counter].SaleQuantity) + 1).toString();
                    }
                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                        var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                        var bFlag = false;
                        for (var count = 0; count < tableData.length; count++) {

                            if ((tableData[count].Itemcode === data[0].Itemcode) && (tableData[count].Location === data[0].Location)) {
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/SaleQuantity", parseInt(tableData[count].SaleQuantity) + 1);
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetAmount", parseFloat(parseFloat(tableData[count].UnitPrice).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetDiscount", parseFloat(parseFloat(tableData[count].Discount).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");

                                var netAmount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetAmount");
                                var netDiscount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetDiscount");
                                var vatPercent = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/VatPercent");
                                that.calculateVATAmount(netAmount, netDiscount, vatPercent, count);
                                that.calculateSalesAmount(netAmount, netDiscount, vatPercent, count);
                                bFlag = true;
                            }
                        }
                        if (!bFlag) {
                            var aProducts = that.getView().getModel("ProductModel").getProperty("/Product");
                            if (promo) {
                                data[0].ToDiscounts.results.push({
                                    "ConditionAmount": that.promoAmount,
                                    "ConditionId": that.retrieveConditionId(data[0]),
                                    "ConditionName": that.promoCondName,
                                    "ConditionType": that.convertPromotionCode(that.promoCondType),
                                    "Currency": "AED",
                                    "DiscountType": "M",
                                    "ItemCode": data[0].Itemcode,
                                    "ModifierType": "D",
                                    "Remarks": "Promotional Discount",
                                    "Authority": ""

                                })
                            }
                            aProducts.push(...data);
                            if (promo) {

                                that.updateProductTable(aProducts.length - 1, data[0], promoData, promo);
                            }
                            that.updateSeq(aProducts);
                            that.checkEnableDisableTile(true);
                            //that.getView().getModel("ProductModel").setProperty("/Product", aProducts);
                            that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");

                            that.backupProdArr.push({
                                "MatCode": data[0].Itemcode,
                                "LocId": data[0].Location,
                                "LocName": data[0].LocationName

                            })
                        }
                    },
                    error: function (oError) {

                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });

                    }
                });
            },
            convertPromotionCode: function (sCode) {
                // Match with regex and rearrange
                return sCode.replace(/ZPM(\d+)/, "Z$1PM");
            },
            reservedItemGlobalLocation: function (data) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "Quantity": data.SaleQuantity.toString(),
                    "ReservationNo": "",
                    "Type": "",
                    "Status": ""

                }

                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                        var tableData = that.getView().getModel("ProductModel").getProperty("/Product");
                        var bFlag = false;
                        for (var count = 0; count < tableData.length; count++) {

                            if ((tableData[count].Itemcode === data.Itemcode) && (tableData[count].Location === data.Location)) {
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/SaleQuantity", parseInt(tableData[count].SaleQuantity) + 1);
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetAmount", parseFloat(parseFloat(tableData[count].UnitPrice).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/Product/" + count + "/NetDiscount", parseFloat(parseFloat(tableData[count].Discount).toFixed(2) * parseFloat(tableData[count].SaleQuantity).toFixed(2)).toFixed(2));
                                that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");

                                var netAmount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetAmount");
                                var netDiscount = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/NetDiscount");
                                var vatPercent = that.getView().getModel("ProductModel").getProperty("/Product/" + count + "/VatPercent");
                                that.calculateVATAmount(netAmount, netDiscount, vatPercent, count);
                                that.calculateSalesAmount(netAmount, netDiscount, vatPercent, count);
                                bFlag = true;
                            }
                        }
                        if (!bFlag) {
                            var aProducts = that.getView().getModel("ProductModel").getProperty("/Product");
                            aProducts.push(data);
                            that.updateSeq(aProducts);
                            that.checkEnableDisableTile(true);
                            //that.getView().getModel("ProductModel").setProperty("/Product", aProducts);
                            that.getView().getModel("ProductModel").setProperty("/MaterialCode", "");
                            that.backupProdArr.push({
                                "MatCode": data.Itemcode,
                                "LocId": data.Location,
                                "LocName": data.LocationName

                            })
                        }
                    },
                    error: function (oError) {

                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });
                    }
                });
            },
            reservedItemonAdditnSub: function (data, mode) {
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "ReservedFlag": "I",
                    "Material": data.Itemcode,
                    "Plant": data.Plant,
                    "Location": data.Location,
                    "ReservationNo": "",
                    "Type": "",
                    "Status": "",
                    "Quantity": data.SaleQuantity.toString()

                }



                this.oModel.create("/ReservationSet", oPayload, {
                    success: function (oData) {

                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === MessageBox.Action.OK) {

                                }
                            }
                        });
                    }
                });
            },
            onSearchNumber: function (oEvent) {
                var that = this;
                var searchNumber = oEvent.getParameter("query");
                var aFilters = [];

                aFilters.push(new sap.ui.model.Filter("Mobile", sap.ui.model.FilterOperator.EQ, searchNumber));
                this.oModel.read("/CustomerSet", {
                    filters: aFilters,
                    success: function (oData) {
                        if (oData) {
                            // this.getView().setModel(oModel1, "AddressModel");
                            if (oData.results.length > 0) {
                                that.getView().getModel("custAddModel").setData({});
                                that.getView().getModel("custAddModel").setData(oData.results[0]);
                                that.getView().getModel("custAddModel").refresh();
                                that.getView().getModel("ShowSection").setProperty("/selectedMode", "Basic Information");

                                if ((oData.HomeAddressLine1 !== "") || (oData.HomeAddressLine2 !== "")) {
                                    sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(0);
                                }
                                else if ((oData.OfficeAddressLine1 !== "") || (oData.OfficeAddressLine2 !== "")) {
                                    sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(1);

                                }
                                else if ((oData.OtherAddressLine1 !== "") || (oData.OtherAddressLine2 !== "")) {
                                    sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(2);

                                }
                                else {
                                    sap.ui.getCore().byId("addressRbGrp").setSelectedIndex(0);
                                }


                            }
                            else {
                                that.showCustomerNotExistMessage();
                            }
                        }


                    },
                    error: function (oError) {
                        that.showCustomerNotExistMessage();
                    }
                });
            },
            showCustomerNotExistMessage: function () {
                sap.m.MessageBox.show("Customer does not exist. Kindly add it", {
                    icon: sap.m.MessageBox.Icon.Error,
                    title: "Error",
                    actions: [MessageBox.Action.OK],
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that.getView().getModel("custAddModel").setData({});
                            that.getView().getModel("ShowSection").setProperty("/selectedMode", "Basic Information");
                        }
                    }
                });
            },
            onSelectAddressType: function (oEvent) {
                if (oEvent.getParameter("selectedIndex") === 0) {
                    sap.ui.getCore().byId("homeSection").setVisible(true);
                    sap.ui.getCore().byId("workSection").setVisible(false);
                    sap.ui.getCore().byId("otherSection").setVisible(false);
                }
                if (oEvent.getParameter("selectedIndex") === 1) {
                    sap.ui.getCore().byId("homeSection").setVisible(false);
                    sap.ui.getCore().byId("workSection").setVisible(true);
                    sap.ui.getCore().byId("otherSection").setVisible(false);
                }
                if (oEvent.getParameter("selectedIndex") === 2) {
                    sap.ui.getCore().byId("homeSection").setVisible(false);
                    sap.ui.getCore().byId("workSection").setVisible(false);
                    sap.ui.getCore().byId("otherSection").setVisible(true);
                }
            },
            onCustomerTypeChange: function (oEvent) {
                var that = this;

                if (oEvent.getParameter("value") === "TOURIST") {
                    // sap.ui.getCore().byId("cardTypelbl").setRequired(true);
                    // sap.ui.getCore().byId("issuedBylbl").setRequired(true);
                    // sap.ui.getCore().byId("cardNumberlbl").setRequired(true);
                    // sap.ui.getCore().byId("nationnalLbl").setRequired(true);
                    // sap.ui.getCore().byId("residencelabl").setRequired(true);
                    that.getView().getModel("custAddModel").setProperty("/Code", "");
                }
                else {
                    // sap.ui.getCore().byId("cardTypelbl").setRequired(false);
                    // sap.ui.getCore().byId("issuedBylbl").setRequired(false);
                    // sap.ui.getCore().byId("cardNumberlbl").setRequired(false);
                    // sap.ui.getCore().byId("nationnalLbl").setRequired(false);
                    // sap.ui.getCore().byId("residencelabl").setRequired(false);
                    that.getView().getModel("custAddModel").setProperty("/Code", "971");
                }

            },
            updateSeq: function (products) {

                if (products.length > 0) {

                    for (var count = 0; count < products.length; count++) {
                        products[count].Seq = (count + 1) * 10;
                    }
                }
                this.getView().getModel("ProductModel").setProperty("/Product", products);
                this.getView().getModel("ProductModel").refresh();
                this.setHeaderData();
            },
            onPressSuspend: function (oEvent) {
                var that = this;
                var transId = this.getView().byId("tranNumber").getCount();
                var prodData = this.getView().getModel("ProductModel").getProperty("/Product");
                var apayload = [];
                var oPayload;

                for (var count = 0; count < prodData.length; count++) {
                    apayload.push({
                        "TransactionId": transId,
                        "ReservedFlag": "D",
                        "Material": prodData[count].Itemcode,
                        "Plant": prodData[count].Plant,
                        "Location": prodData[count].Location,
                        "Quantity": prodData[count].SaleQuantity.toString(),
                        "ReservationNo": "",
                        "Type": "",
                        "Status": ""
                    })
                }

                oPayload = {
                    "TransactionId": transId,
                    "ToItems": {
                        "results": apayload
                    }
                }
                this.getView().setBusy(true);
                this._oDialogSuspComments.setBusy(true);
                this.oModel.create("/ReservationHeadSet", oPayload, {
                    success: function (oData) {
                        sap.m.MessageToast.show("Success in Suspend the item");
                        that.getView().setBusy(false);
                        that._oDialogSuspComments.setBusy(close);
                        that._oDialogSuspComments.close();

                        that.onPressPayment(false);
                        //window.location.reload(true);
                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        sap.m.MessageToast.show("Error in Suspend the item");
                    }
                });
            },
            checkHomeDelivery: function () {
                var delivery = "";
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < tableData.length; count++) {

                    if (tableData[count].HomeDelivery) {
                        delivery = "HD";
                        break;
                    }
                }

                return delivery;

            },
            oPayloadTableItems: function () {
                var itemArr = [];
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < tableData.length; count++) {

                    itemArr.push({
                        "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                        "TransactionItem": tableData[count].Seq.toString(),
                        "Plant": tableData[count].Plant,
                        "Location": tableData[count].Location,
                        "Material": tableData[count].Itemcode,
                        "Description": tableData[count].Description,
                        "Quantity": tableData[count].SaleQuantity.toString(),
                        "Unit": tableData[count].Unit,
                        "UnitPrice": tableData[count].UnitPrice,
                        "UnitDiscount": tableData[count].Discount.toString().replace("-", ""),
                        "GrossAmount": tableData[count].NetAmount.toString(),
                        "Discount": tableData[count].NetDiscount.toString().replace("-", ""),
                        "NetAmount": parseFloat(parseFloat(tableData[count].NetAmount) + parseFloat(tableData[count].NetDiscount)).toFixed(2),
                        "VatAmount": tableData[count].VatAmount,
                        "SaleAmount": tableData[count].SaleAmount.toString(),
                        "Currency": "AED",
                        "FocItem": "",
                        "SalesmanId": tableData[count].SalesmanId,
                        "SalesmanName": tableData[count].SalesmanName,
                        "VatPercent": tableData[count].VatPercent
                    })
                }

                return itemArr;
            },
            oPayloadTableDiscountItems: function () {
                var itemArr = [];
                var tableData = that.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < tableData.length; count++) {
                    var itemDiscount = tableData[count].ToDiscounts.results;
                    for (var count1 = 0; count1 < itemDiscount.length; count1++) {
                        itemArr.push({
                            "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                            "TransactionItem": tableData[count].Seq.toString(),
                            "ConditionId": itemDiscount[count1].ConditionId,
                            "ConditionType": itemDiscount[count1].ConditionType,
                            "ConditionName": itemDiscount[count1].ConditionName,
                            "ConditionAmount": itemDiscount[count1].ConditionAmount,
                            "Currency": itemDiscount[count1].Currency,
                            "DiscountType": itemDiscount[count1].DiscountType,
                            "ModifierType": itemDiscount[count1].ModifierType,
                            "Remarks": itemDiscount[count1].Remarks,
                            "Authority": itemDiscount[count1].Authority

                        })
                    }

                }

                return itemArr;
            },
            oPayloadTablePayments: function () {
                var itemArr = [];
                itemArr.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                    "PaymentId": "1",   // sequence of payment
                    "PaymentDate": new Date(),
                    "PaymentMethod": "011", // 011- CASH
                    "PaymentMethodName": "Cash",
                    "Amount": this.getView().byId("saleAmount").getCount().toString(),
                    "Currency": "AED",
                    "CardNumber": "",
                    "AuthorizationCode": "",
                    "CardType": ""

                })

                return itemArr;
            },
            oPayloadSerialNumber: function () {
                var aSerialNumber = []
                var id = 0;
                if (this.serialNumbers.length > 0) {
                    for (var count = 0; count < this.serialNumbers.length; count++) {
                        aSerialNumber.push({
                            "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                            "TransactionItem": this.serialNumbers[count].seq.toString(),
                            "SerialId": (id + 1).toString(),
                            "SerialNo": this.serialNumbers[count].serialNumber,
                            "VoucherType": "",
                            "VoucherStatus": "",
                            "VoucherAmount": "0.00",
                            "Currency": "",
                            "ExpiryDate": new Date()
                        })
                        id = id + 1;
                    }

                    return aSerialNumber;
                }
                else {

                    return aSerialNumber;
                }

            },
            linkSalesman: function (oEvent) {
                var oComboBox = oEvent.getSource();
                var oSelectedItem = oComboBox.getSelectedItem();

                if (!oSelectedItem) {
                    return;
                }

                var sSalesmanCode = oSelectedItem.getKey();
                var sSalesmanName = oSelectedItem.getText();
                var oContext = oComboBox.getBindingContext("ProductModel");
                if (oContext) {
                    var sPath = oContext.getPath(); // e.g., /Product/0
                    var oModel = oContext.getModel();
                    oModel.setProperty(sPath + "/SalesmanId", sSalesmanCode);
                    oModel.setProperty(sPath + "/SalesmanName", sSalesmanName);

                }
            },
            getTimeInISO8601Format: function () {
                const now = new Date();
                const hours = now.getHours();      // 24-hour format
                const minutes = now.getMinutes();
                const seconds = now.getSeconds();

                return `PT${hours}H${minutes}M${seconds}S`;
            },
            onPressPaymentTest: function () {
                this.onPressPayment(true);
            },
            resolveTimeDifference: function (dateTime) {
                if (dateTime !== undefined && dateTime !== null && dateTime !== "") {
                    var offSet = dateTime.getTimezoneOffset();
                    var offSetVal = dateTime.getTimezoneOffset() / 60;
                    var h = Math.floor(Math.abs(offSetVal));
                    var m = Math.floor((Math.abs(offSetVal) * 60) % 60);
                    dateTime = new Date(dateTime.setHours(h, m, 0, 0));
                    return dateTime;

                }

                return null;

            },
            onPressPayment: function (bflag) {

                var mode = "";
                var delDate = ""
                var shippingMode = this.checkHomeDelivery();
                var custData = this.getView().getModel("custAddModel").getData();
                var contactNumber = "";
                custData.Code ? custData.Code : "" + custData.Mobile ? custData.Mobile : ""
                if (custData.Code) {
                    contactNumber = contactNumber + custData.Code;
                }
                if (custData.Mobile) {
                    contactNumber = contactNumber + custData.Mobile;
                }
                if (shippingMode === "HD") {
                    if (this.shippingDate) {
                        delDate = new Date(this.shippingDate);
                    }
                    else {
                        delDate = new Date();
                    }

                }
                else {
                    delDate = new Date();
                }
                if (bflag) {
                    mode = "1"; // completed
                }
                else {
                    mode = "3"; // suspended
                }
                var that = this;
                var oPayload = {
                    "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                    "TransactionDate": new Date(),//new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    "ExpiryDate": new Date(),
                    "TransactionTime": this.getTimeInISO8601Format(),//new Date().toTimeString().slice(0, 8).replace(/:/g, ''),
                    "TransactionStatus": mode,
                    "SalesOrder": "",
                    "Flag": "",
                    "Store": that.storeID,
                    "Plant": that.plantID,
                    "CashierId": that.cashierID,
                    "CashierName": that.cashierName,
                    "TransactionType": "1",
                    "ShippingMethod": this.shippingMethod,
                    "GrossAmount": this.getView().byId("gross").getCount().toString(),
                    "Discount": this.getView().byId("discount").getCount().toString().replace("-", ""),
                    "VatAmount": this.getView().byId("vat").getCount().toString(),
                    "SaleAmount": this.getView().byId("saleAmount").getCount().toString(),
                    "Currency": "AED",
                    "OriginalTransactionId": "", // Required for Return Sales
                    "CustomerType": this.getView().getModel("custAddModel").getData().CustomerType,
                    "CustomerName": this.getView().byId("customer").getCount(),
                    "ContactNo": contactNumber,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "Mobile": this.getView().getModel("custAddModel").getData().Mobile,
                    "EMail": this.getView().getModel("custAddModel").getData().Email,
                    "Address": this.shippingAddress,
                    "ShippingInstruction": this.shippingInst,
                    "DeliveryInstruction": this.deliveryInstruction,
                    "DeliveryDate": this.resolveTimeDifference(delDate),
                    "ToItems": { "results": this.oPayloadTableItems() },
                    "ToDiscounts": { "results": this.oPayloadTableDiscountItems() },
                    "ToPayments": { "results": this.oPayloadPayments(this.aPaymentEntries) },
                    "ToSerials": { "results": this.oPayloadSerialNumber() },
                    "ToSignature": { "results": this.oPaySignatureload ? this.oPaySignatureload : [] },
                    "Remarks": this.suspendComments,
                    "ToBankEMI":{ "results": this.emiList}
                    // "ToPayments" : {"results" : this.oPayloadTablePayments()}
                }
                this.getView().setBusy(true);
                if (this._oDialogPayment) {
                    this._oDialogPayment.setBusy(true);
                }

                this.oModel.create("/SalesTransactionHeaderSet", oPayload, {
                    success: function (oData) {
                        if (!bflag) {
                            window.location.reload(true);
                        }
                        else {
                            if (oData.PlanetURL.length > 0) {
                                that.openPlanet(oData.PlanetURL, bflag, that.getView().byId("tranNumber").getCount().toString());
                            }
                            else {
                                that.getView().setBusy(false);
                                if (that._oDialogPayment) {
                                    that._oDialogPayment.setBusy(false);
                                }
                                if (that._pAddRecordDialog) {
                                    that._pAddRecordDialog.setBusy(false);
                                }


                                if (oData) {

                                    MessageBox.success("Transaction Posted Successfully.", {
                                        onClose: function (sAction) {
                                            for (var count = 1; count <= 2; count++) {
                                                that.getPDFBase64(count);
                                            }
                                            // window.location.reload(true);

                                        }
                                    });
                                }
                                if (!bflag) {
                                    window.location.reload(true);
                                }
                            }
                        }


                    },
                    error: function (oError) {
                        that.getView().setBusy(false);
                        that._oDialogPayment.setBusy(false);
                        sap.m.MessageToast.show("Error");
                    }
                });

            },
            getPDFBase64: function (count) {
                var that = this;
                var tranNumber = this.getView().byId("tranNumber").getCount().toString();
                var sUrl = "/sap/opu/odata/SAP/ZEROS_RETAIL_PROJECT_SRV/TransactionPDFSet(TransactionId='" + tranNumber + "',TransactionCopy='" + count + "')/$value";

                // Create XMLHttpRequest
                var xhr = new XMLHttpRequest();
                xhr.open("GET", sUrl, true);
                xhr.responseType = "arraybuffer"; // Important to get binary content

                xhr.onload = function () {
                    if (xhr.status === 200) {
                        var oHtmlControl = sap.ui.core.Fragment.byId("SignaturePad", "pdfCanvas");
                        var iframeContent = '<div id="pdf-viewport"></div>';
                        oHtmlControl.setContent(iframeContent);
                        oHtmlControl.setVisible(true);

                        var oPrintBox = sap.ui.core.Fragment.byId("SignaturePad", "printBox");
                        oPrintBox.setVisible(true);

                        var oSignBox = sap.ui.core.Fragment.byId("SignaturePad", "signBox");
                        oSignBox.setVisible(false);
                        // Convert binary to Base64
                        var binary = '';
                        var bytes = new Uint8Array(xhr.response);
                        var len = bytes.byteLength;
                        for (var i = 0; i < len; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }

                        var base64 = btoa(binary);
                        console.log("Base64 PDF Content:", base64);

                        that.onShowPDFSEPP(base64);

                    } else {
                        console.error("Failed to fetch PDF. Status: ", xhr.status);
                    }
                };

                xhr.send();
            },


            onShowPDFSEPP: async function (base64Content) {

                var byteCharacters = atob(base64Content);
                var byteNumbers = new Array(byteCharacters.length);

                for (var i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }

                var byteArray = new Uint8Array(byteNumbers);


                var blob = new Blob([byteArray], {
                    type: 'application/pdf'
                });


                var pdfUrl = URL.createObjectURL(blob);

                var printerIp = "192.168.10.75"; // your Epson printer IP

                try {
                    const canvas = await this.loadPdfToCanvas(pdfUrl);
                    this.canvasp = canvas;
                    this.printerIP = printerIp;

                    this.sendToEpsonPrinter(canvas, printerIp);
                } catch (err) {
                    MessageBox.error("Error rendering or printing PDF: " + err.message);
                }

            },
            onPressPrint: function () {
                this.sendToEpsonPrinter(this.canvasp, this.printerIP);
            },
            isSingleColor: function (imageData) {
                const stride = 4;
                for (let offset = 0; offset < stride; offset++) {
                    const first = imageData[offset];
                    for (let i = offset; i < imageData.length; i += stride) {
                        if (first !== imageData[i]) {
                            return false;
                        }
                    }
                }
                return true;
            },
            loadPdfToCanvas: async function (pdfUrl) {
                await this.ensurePdfJsLib();

                try {
                    const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
                    const printerWidth = 576;
                    const canvasArray = [];

                    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                        const page = await pdfDoc.getPage(pageNum);
                        const scale = printerWidth / page.getViewport({ scale: 1 }).width;
                        const viewport = page.getViewport({ scale });
                        const pdfContainer = document.getElementById("pdf-viewport");
                        const canvas = document.createElement("canvas");
                        // pdfContainer.appendChild(canvas);
                        const width = viewport.width;
                        const height = viewport.height;
                        canvas.height = height;
                        canvas.width = width;
                        canvas.style.width = Math.floor(width) + "px";
                        canvas.style.height = Math.floor(height) + "px";
                        canvas.setAttribute("willReadFrequently", "true");
                        // canvas.width = viewport.width;
                        // canvas.height = viewport.height;
                        const context = canvas.getContext("2d", { willReadFrequently: true });
                        context.clearRect(0, 0, width, height);

                        await page.render({
                            canvasContext: context,
                            viewport
                        }).promise;

                        let top = 0;
                        let bottom = height;
                        let left = 0;
                        let right = width;

                        while (top < bottom) {
                            const imageData = context.getImageData(
                                left,
                                top,
                                right - left,
                                1
                            ).data;
                            if (!this.isSingleColor(imageData)) {
                                break;
                            }
                            top++;
                        }
                        while (top < bottom) {
                            const imageData = context.getImageData(
                                left,
                                bottom,
                                right - left,
                                1
                            ).data;
                            if (!this.isSingleColor(imageData)) {
                                break;
                            }
                            bottom--;
                        }
                        while (left < right) {
                            const imageData = context.getImageData(
                                left,
                                top,
                                1,
                                bottom - top
                            ).data;
                            if (!this.isSingleColor(imageData)) {
                                break;
                            }
                            left++;
                        }
                        while (left < right) {
                            const imageData = context.getImageData(
                                right,
                                top,
                                1,
                                bottom - top
                            ).data;
                            if (!this.isSingleColor(imageData)) {
                                break;
                            }
                            right--;
                        }

                        context.clearRect(0, 0, width, height);
                        const adjustedScale = printerWidth / (right - left);
                        const adjustedWidth = (right - left) * adjustedScale;
                        const adjustedHeight = (bottom - top) * adjustedScale;

                        canvas.height = adjustedHeight + 10;
                        canvas.width = adjustedWidth;
                        canvas.style.width = `${adjustedWidth}px`;
                        canvas.style.height = `${adjustedHeight}px`;

                        pdfContainer.appendChild(canvas);
                        await page.render({
                            canvasContext: context,
                            viewport,
                        }).promise;

                        // Store each rendered canvas
                        canvasArray.push(canvas);
                    }

                    // Now return array of canvases or send to printer
                    return canvasArray;

                } catch (error) {
                    console.error("Error loading PDF:", error);
                    MessageToast.show("Failed to load PDF: " + error.message);
                }
            },
            ensurePdfJsLib: async function () {
                if (!window.pdfjsLib) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
                        script.onload = () => {
                            window.pdfjsLib = window['pdfjs-dist/build/pdf'];
                            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
                            resolve();
                        };
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
            },

            sendToEpsonPrinter: function (canvases, printerIp) {
                var ePosDev = new epson.ePOSDevice();
                //var ip = this.getView().byId("ipaddr").getValue();
                // var wdth = this.getView().byId("wdth").getValue();
                // var ht = this.getView().byId("heht").getValue();

                ePosDev.connect(printerIp, 8008, function (resultConnect) {
                    if (resultConnect === "OK" || resultConnect == "SSL_CONNECT_OK") {
                        ePosDev.createDevice("local_printer", ePosDev.DEVICE_TYPE_PRINTER,
                            { crypto: false, buffer: false },
                            function (deviceObj, resultCreate) {
                                if (resultCreate === "OK") {
                                    var printer = deviceObj;



                                    printer.brightness = 1.0;
                                    printer.halftone = printer.HALFTONE_ERROR_DIFFUSION;
                                    for (const canvas of canvases) {
                                        printer.addImage(canvas.getContext("2d", { willReadFrequently: true }), 0, 0, canvas.width, canvas.height, printer.COLOR_1, printer.MODE_MONO);
                                    }


                                    printer.addCut(printer.CUT_FEED);
                                    printer.send();
                                    // printer.send(function (resultSend) {
                                    //     if (resultSend === "OK") {
                                    //         sap.m.MessageToast.show("Printed successfully!");
                                    //     } else {
                                    //         sap.m.MessageBox.error("Print failed: " + resultSend);
                                    //     }
                                    // });
                                } else {
                                    sap.m.MessageBox.error("Failed to create device: " + resultCreate);
                                }
                            }
                        );
                    } else {
                        //sap.m.MessageBox.error("Connection failed: " + resultConnect);
                        sap.m.MessageBox.error("Connection failed: " + resultConnect, {
                            title: "Error",
                            actions: [sap.m.MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (oAction === sap.m.MessageBox.Action.OK) {
                                    window.location.reload(true);
                                }
                            }.bind(this)
                        });
                    }
                });
            },

            openPlanet: function (url, bflag, transID) {
                var that = this;
                var wind = window.open(url, "_blank");
                that.oModel.read("/PlanetTagSet('" + transID + "')", {
                    success: function (oData) {

                        that.getView().setBusy(false);
                        if (that._oDialogPayment) {
                            that._oDialogPayment.setBusy(false);
                        }
                        that._pAddRecordDialog.setBusy(false);

                        MessageBox.success("Transaction Posted Successfully.", {
                            onClose: function (sAction) {
                                for (var count = 1; count <= 2; count++) {
                                    that.getPDFBase64(count);
                                }

                                // window.location.reload(true);
                            }
                        });
                        if (!bflag) {
                            window.location.reload(true);
                        }







                    },
                    error: function (oError) {

                        sap.m.MessageToast.show("Error");
                    }
                });
            },
            oPayloadPayments: function (arrPayment) {
                if (arrPayment.length > 0) {
                    return arrPayment.map(item => {
                        return {
                            ...item,
                            Amount: item.Amount.toString()
                        };
                    });
                }
                else {
                    return [];
                }
            },
            onRetrieveTerminal: function (oEvent) {
                this.cashAmount = oEvent.getParameter("value");
                var that = this;
                var aFilters = [];
                if (parseFloat(this.cashAmount) <= parseFloat(sap.ui.getCore().byId("totalSaleBalText").getText())) {
                    aFilters.push(new sap.ui.model.Filter("Store", sap.ui.model.FilterOperator.EQ, this.storeID));
                    this.oModel.read("/TerminalsSet", {
                        filters: aFilters,
                        success: function (oData) {
                            that.getView().getModel("ShowPaymentSection").setProperty("/Terminal", []);
                            that.getView().getModel("ShowPaymentSection").setProperty("/Terminal", oData.results);

                        },
                        error: function (oError) {
                            sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                                icon: sap.m.MessageBox.Icon.Error,
                                title: "Error",
                                actions: [MessageBox.Action.OK],
                                onClose: function (oAction) {
                                    if (oAction === MessageBox.Action.OK) {

                                    }
                                }
                            });
                        }
                    });
                }
                else {
                    sap.m.MessageBox.error("Entered Amount is more than Sale Amount");
                }

            },
            onPressTenderCard: function (oEvent) {
                // var terminalID = oEvent.getParameter("srcControl").getAggregation("items")[0].getProperty("text")
                // var machindID = oEvent.getParameter("srcControl").getAggregation("items")[1].getProperty("text");

                var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
                var oVBox = oItem.getContent ? oItem.getContent()[0] : oItem.getAggregation("content")[0];
                var aItems = oVBox.getItems ? oVBox.getItems() : oVBox.getAggregation("items");
                this.terminalID = aItems[0]?.getText();
                this.machineID = aItems[1]?.getText();
                this.onOpenPaymentDialog();
                //this.initiateTransaction(terminalID, machineID);
            },
            onOpenPaymentDialog: function () {
                var oView = this;

                if (!this._oPaymentDialog) {
                    this._oPaymentDialog = new sap.m.Dialog({
                        title: "Select Payment Method",
                        type: "Message",
                        content: [
                            new sap.m.RadioButtonGroup("idPaymentOptions", {
                                columns: 1,
                                selectedIndex: 0, // default selection (AANI)
                                buttons: [
                                    new sap.m.RadioButton({ text: "AANI" }),
                                    new sap.m.RadioButton({ text: "NPCI" }),
                                    new sap.m.RadioButton({ text: "Card Payment" })
                                ]
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: "Submit",
                            press: function () {
                                var oRbGroup = sap.ui.getCore().byId("idPaymentOptions");
                                var iSelectedIndex = oRbGroup.getSelectedIndex();
                                var sSelectedText = oRbGroup.getButtons()[iSelectedIndex].getText();

                                sap.m.MessageToast.show("Selected: " + sSelectedText);

                                // 👉 you can also store it in model instead of toast
                                // oView.getModel("JMBPCreate").setProperty("/paymentMethod", sSelectedText);

                                oView._oPaymentDialog.close();
                                oView.initiateTransaction(oView.terminalID, oView.machineID, sSelectedText);
                            }
                        }).addStyleClass("cstmBtn"),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function () {
                                oView._oPaymentDialog.close();
                            }
                        }).addStyleClass("cstmBtn")
                    });

                    oView.getView().addDependent(this._oPaymentDialog);
                }

                this._oPaymentDialog.open();
            },

            onPressTenderCash: function (oEvent) {
                var terminalID = oEvent.getParameter("srcControl").getAggregation("items")[0].getText();
                var machindID = oEvent.getParameter("srcControl").getAggregation("items")[1].getText();
                this.initiateTransaction(terminalID, machindID);
            },
            initiateTransaction: function (termID, machID, type) {
                var that = this;
                var transType = "";
                if (type === "AANI") {
                    transType = "pushPaymentIppSale";
                } else if (type === "NPCI") {
                    transType = "pushPaymentNpciQRSale";
                } else {
                    transType = "pushPaymentSale";
                }

                sap.ui.core.BusyIndicator.show();
                // BusyDialog.open();
                var oPayload = {
                    "Tid": termID,
                    "Mid": machID,
                    "TransactionType": transType,
                    "SourceId": this.getView().byId("tranNumber").getCount().toString() + this.sourceIdCounter.toString(),
                    "Amount": this.cashAmount.toString()

                }

                this.oModel.create("/PaymentStartTransactionSet", oPayload, {
                    success: function (oData) {
                        that.sourceIdCounter = that.sourceIdCounter + 1;
                        that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                        sap.ui.getCore().byId("creditAmount").setValue("");
                        that.getView().getModel("ShowPaymentSection").setProperty("/Terminal", []);
                        that.getView().getModel("ShowPaymentSection").refresh();
                        sap.ui.core.BusyIndicator.hide();
                        that.paymentId = that.paymentId + 1;
                        that.getView().setBusy(false);
                        that.aPaymentEntries.push({
                            "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                            "PaymentId": that.paymentId.toString(),
                            "PaymentDate": new Date(),
                            "Amount": oData.Amount,
                            "Currency": "AED",
                            "PaymentMethod": "",
                            "PaymentMethodName": "Card",
                            "Tid": oData.Tid,
                            "Mid": oData.Mid,
                            "CardType": oData.CardType,
                            "CardLabel": oData.CardLabel,
                            "CardNumber": oData.CardNumber,
                            "AuthorizationCode": oData.AuthorizationCode,
                            "CardReceiptNo": oData.CardReceiptNo,
                            "PaymentType": "CARD",
                            "VoucherNumber": "",
                            "ChangeAmount": "0.00",
                            "SourceId": that.getView().byId("tranNumber").getCount().toString() + that.paymentEntSourceCounter.toString()


                        });

                        var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                        var paidAmount = 0;
                        for (var count1 = 0; count1 < that.aPaymentEntries.length; count1++) {

                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        if (balanceAmount <= 0) {
                            sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                            sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                            sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                            that.onOpenSignaturePad();
                            //that.OnSignaturePress();
                            // that.onPressPaymentTest();
                        }
                        else {
                            sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                            sap.ui.getCore().byId("cash").setValue("");
                            sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        }


                        sap.m.MessageToast.show("Card Payment Successful");
                        sap.m.MessageBox.show(
                            "Do you want to convert the transaction into EMI ?", {
                            icon: sap.m.MessageBox.Icon.INFORMATION,
                            title: "Custom Message Box",
                            actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                            onClose: function (sAction) {
                                if (sAction === sap.m.MessageBox.Action.OK) {
                                    that.openEMIDialog(oData.Amount);
                                } else if (sAction === sap.m.MessageBox.Action.CANCEL) {
                                    // Cancel button was pressed
                                    sap.m.MessageToast.show("You pressed Cancel");
                                }
                            }
                        }
                        );

                    },
                    error: function (oError) {
                        that.sourceIdCounter = that.sourceIdCounter + 1;
                        var errMessage = "";
                        sap.ui.core.BusyIndicator.hide();
                        if (JSON.parse(oError.responseText).error.message.value) {
                            errMessage = JSON.parse(oError.responseText).error.message.value;
                        }
                        else {
                            errMessage = "Error During Payment Transaction "
                        }

                        sap.m.MessageBox.show(errMessage, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });


                    }
                });
            },
            openEMIDialog: function (amt) {
                var that = this;
                var oView = this.getView();
                this.oModel.read("/BankEMISet", {
                    success: function (oData) {

                        if (oData.results.length > 0) {
                            var aResults = oData.results;
                            var aBankNames = [...new Set(aResults.map(item => item.BankName))]
                                .map(bank => ({ BankName: bank }));
                            var emiModel = new sap.ui.model.json.JSONModel({
                                bankList: aBankNames,
                                monthList: [],
                                selectedBank: "",
                                selectedMonths: "",
                                interestRate: "",
                                amount: amt
                            });
                            that.getView().setModel(emiModel, "emiModel");
                            var oRawDataModel = new sap.ui.model.json.JSONModel({ results: aResults });
                            that.getView().setModel(oRawDataModel, "rawModel");

                            if (!that._oBankEMIDialog) {
                                that._oBankEMIDialog = sap.ui.xmlfragment(
                                    oView.getId(),
                                    "com.eros.salesprocess.fragment.BankEMIDialog",
                                    that
                                );
                                oView.addDependent(that._oBankEMIDialog);
                            }



                            that._oBankEMIDialog.open();


                        }
                    }
                    ,
                    error: function (oError) {
                        sap.m.MessageBox.show(
                            JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {

                            }
                        }
                        );


                    }
                });

            },
            onBankChange: function (oEvent) {
                var sSelectedBank = oEvent.getParameter("selectedItem").getKey();
                var oRawData = this.getView().getModel("rawModel").getData().results;

                var aFilteredMonths = oRawData.filter(item => item.BankName === sSelectedBank)
                    .map(item => ({ NoOfMonths: item.NoOfMonths }));

                // Remove duplicates
                aFilteredMonths = [...new Map(aFilteredMonths.map(item => [item.NoOfMonths, item])).values()];

                var oViewModel = this.getView().getModel("emiModel");
                oViewModel.setProperty("/monthList", aFilteredMonths);
                oViewModel.setProperty("/selectedMonths", "");
                oViewModel.setProperty("/interestRate", "");
            },
            onMonthChange: function (oEvent) {
                var sSelectedBank = this.getView().getModel("emiModel").getProperty("/selectedBank");
                var sSelectedMonth = oEvent.getParameter("selectedItem").getKey();
                var oRawData = this.getView().getModel("rawModel").getData().results;

                var oRecord = oRawData.find(item => item.BankName === sSelectedBank && item.NoOfMonths === sSelectedMonth);

                var sInterestRate = oRecord ? oRecord.InterestRate : "";

                this.getView().getModel("emiModel").setProperty("/interestRate", sInterestRate);
            },
            onSubmitEMIDialog: function () {
                var oViewModel = this.getView().getModel("emiModel");
                var sBank = oViewModel.getProperty("/selectedBank");
                var sMonths = oViewModel.getProperty("/selectedMonths");
                var sRate = oViewModel.getProperty("/interestRate");
                var amount = oViewModel.getProperty("/amount");

                if (!sBank || !sMonths) {
                    sap.m.MessageBox.error("Please select both Bank Name and No. of Months.");
                    return;
                }
                this.emiID = this.emiID + 1 ;
                this.emiList.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                    "EmiId": this.emiID,
                    "Amount":amount,
                    "Currency": "AED",
                    "BankName":sBank,
                    "NoOfMonths":sMonths ,
                    "InterestRate": sRate
                });
            },
            onCloseEMIDialog: function () {
                that._oBankEMIDialog.close();
            },
            checkEnableDisableTile: function (bflag) {
                this.getView().byId("customergt").setPressEnabled(true);
                this.getView().byId("discountgt").setPressEnabled(bflag);
                this.getView().byId("paymentsgt").setPressEnabled(bflag);
                this.getView().byId("suspendgt").setPressEnabled(bflag);

            },
            holdDiscountItem: function (oEvent) {
                var itemCode = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject().Itemcode;
                var itemDesc = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject().Description;
                var itemUnitPrice = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject().UnitPrice;
                this.getView().getModel("DiscountValue").setProperty("/ItemCode", itemCode);
                this.getView().getModel("DiscountValue").setProperty("/ItemDesc", itemDesc);
                this.getView().getModel("DiscountValue").setProperty("/ItemUnitPrice", itemUnitPrice);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Discounts Condition");
            },
            selectSuspendReason: function (oEvent) {
                this.suspendComments = oEvent.getParameter("listItem").getBindingContext().getObject().Reason;
                this.onPressSuspend();
            },

            holdDiscountCondition: function (oEvent) {
                var conditionType = oEvent.getParameter("listItem").getBindingContext().getObject().ConditionType;
                var conditionName = oEvent.getParameter("listItem").getBindingContext().getObject().ConditionName;
                this.checkPercentage = oEvent.getParameter("listItem").getBindingContext().getObject().Percent;
                if (this.checkPercentage === "X") {
                    sap.ui.getCore().byId("discountAmount").setPlaceholder("Enter Discount Percentage");
                }
                else {
                    sap.ui.getCore().byId("discountAmount").setPlaceholder("Enter Discount Amount");
                }
                this.getView().getModel("DiscountValue").setProperty("/ConditionType", conditionType);
                this.getView().getModel("DiscountValue").setProperty("/ConditionName", conditionName);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Reason Type");
            },
            holdReasonType: function (oEvent) {
                // var reason = oEvent.getParameter("listItem").getBindingContext().getObject().Reason;
                //this.getView().getModel("DiscountValue").setProperty("/Reason", reason);
                this.getView().getModel("DiscountValue").setProperty("/Reason", oEvent.getParameter("value"));
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Authority");
                oEvent.getSource().setValue("");
            },
            holdAuthority: function (oEvent) {
                var authority = oEvent.getParameter("listItem").getBindingContext().getObject().Authority;
                this.getView().getModel("DiscountValue").setProperty("/Authority", authority);
                this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "Amount");
            },
            holdDiscountAmount: function (oEvent) {
                var discAmount = oEvent.getParameter("value");
                var itemUnitPrice = this.getView().getModel("DiscountValue").getProperty("/ItemUnitPrice");
                var conditionType = this.getView().getModel("DiscountValue").getProperty("/ConditionType");
                var itemCode = this.getView().getModel("DiscountValue").getProperty("/ItemCode");
                if (this.checkPercentage === "X") {
                    discAmount = parseFloat(itemUnitPrice * (discAmount) / 100).toFixed(2);
                }
                if (conditionType !== "ZSUS") {
                    if (parseFloat(discAmount).toFixed(2) <= parseFloat(itemUnitPrice).toFixed(2)) {
                        this.getView().getModel("DiscountValue").setProperty("/DiscAmount", discAmount);
                        this.addDiscount();
                        this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "View All Records");
                        sap.ui.getCore().byId("discountAmount").setValue("");
                    }
                    else {

                        if (this.aEntries1 && this.aEntries1.length > 0) {
                            var foundEntry = this.aEntries1.find(function (entry) {
                                return entry.ItemCode === itemCode && entry.Type === "ZSUS";
                            });
                            if (foundEntry) {
                                var conditionAmount = foundEntry.Amount;
                                var itemPrice = parseFloat(parseFloat(itemUnitPrice) + parseFloat(conditionAmount)).toFixed(2);

                                if (parseFloat(discAmount).toFixed(2) <= parseFloat(itemPrice)) {
                                    this.getView().getModel("DiscountValue").setProperty("/DiscAmount", discAmount);
                                    this.addDiscount();
                                    this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "View All Records");
                                    sap.ui.getCore().byId("discountAmount").setValue("");
                                }
                                else {
                                    oEvent.getSource().setValue("");
                                    sap.m.MessageBox.error("Discount Amount Should not exceed more than Item Unit Price");
                                }
                            }
                            else {
                                oEvent.getSource().setValue("");
                                sap.m.MessageBox.error("Discount Amount Should not exceed more than Item Unit Price");
                            }

                        }
                        else {
                            oEvent.getSource().setValue("");
                            sap.m.MessageBox.error("Discount Amount Should not exceed more than Item Unit Price");
                        }








                    }
                }
                else {
                    this.getView().getModel("DiscountValue").setProperty("/DiscAmount", discAmount);
                    this.addDiscount();
                    this.getView().getModel("ShowDiscountSection").setProperty("/selectedMode", "View All Records");
                    sap.ui.getCore().byId("discountAmount").setValue("");
                }





            },
            addDiscount: function () {
                var duplicate = false;
                var discountData = this.getView().getModel("DiscountValue").getData();
                if (this.aEntries1.length > 0) {

                    for (var count = 0; count < this.aEntries1.length; count++) {
                        if (this.aEntries1[count].ItemCode === discountData.ItemCode && this.aEntries1[count].Type === discountData.ConditionType) {
                            duplicate = true;
                            break;
                        }
                    }
                }

                if (!duplicate) {
                    if (discountData.ItemCode && discountData.ConditionType && discountData.DiscAmount) {
                        this.aEntries1.push({
                            ItemCode: discountData.ItemCode,
                            ItemDescription: discountData.ItemDesc,
                            Reason: discountData.Reason,
                            Type: discountData.ConditionType,
                            Amount: parseFloat(discountData.DiscAmount).toFixed(2),
                            Authority: discountData.Authority,
                            ConditionName: discountData.ConditionName,
                            DiscountType: "M"

                        });
                    }
                }
                else {
                    if (discountData.DiscAmount) {
                        MessageBox.error("Same Discount has been already applied. Kindly Delete the existing record to add new Discount");
                    }
                    else {
                        MessageBox.error("Entered the Discount Amount");
                    }

                }

                var oModel1 = new sap.ui.model.json.JSONModel();
                oModel1.setData({ "entries": this.aEntries1 });
                this.getView().setModel(oModel1, "discountModelTable");

                this.getView().getModel("DiscountValue").setProperty("/ItemCode", "");
                this.getView().getModel("DiscountValue").setProperty("/ItemDesc", "");
                this.getView().getModel("DiscountValue").setProperty("/ConditionType", "");
                this.getView().getModel("DiscountValue").setProperty("/ConditionName", "");
                this.getView().getModel("DiscountValue").setProperty("/DiscAmount", "");
                this.getView().getModel("DiscountValue").setProperty("/Authority", "");
                this.getView().getModel("DiscountValue").setProperty("/Reason", "");
                this.getView().getModel("DiscountValue").refresh();
            },
            onCloseManualDiscount1: function () {
                this._oDialogDiscoun1.close();
            },
            onApplyManualDiscount1: function () {
                var discountTblData = this.getView().getModel("discountModelTable").getProperty("/entries");
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");

                for (var count = 0; count < productTblData.length; count++) {

                    for (var count1 = 0; count1 < discountTblData.length; count1++) {
                        if (discountTblData[count1].ItemCode === productTblData[count].Itemcode) {
                            var bflag = false;
                            for (var count2 = 0; count2 < productTblData[count].ToDiscounts.results.length; count2++) {
                                var dataObj = productTblData[count].ToDiscounts.results;
                                if (dataObj[count2].ItemCode === discountTblData[count1].ItemCode && dataObj[count2].ConditionName === discountTblData[count1].ConditionName) {
                                    bflag = true;
                                    break;
                                }

                            }
                            if (!bflag) {
                                var condAmount = "";
                                if (discountTblData[count1].Type === "ZSUS") {
                                    condAmount = discountTblData[count1].Amount;
                                }
                                else {
                                    condAmount = "-" + discountTblData[count1].Amount;
                                }
                                productTblData[count].ToDiscounts.results.push({
                                    "ConditionAmount": condAmount,
                                    "ConditionId": this.retrieveConditionId(productTblData[count]),
                                    "ConditionName": discountTblData[count1].ConditionName,
                                    "ConditionType": discountTblData[count1].Type,
                                    "Currency": "AED",
                                    "DiscountType": "M",
                                    "ItemCode": discountTblData[count1].ItemCode,
                                    "ModifierType": "D",
                                    "Remarks": discountTblData[count1].Reason,
                                    "Authority": discountTblData[count1].Authority

                                })
                                this.updateProductTable(count, productTblData[count], discountTblData[count1]);
                            }
                        }
                    }
                }
                this.onCloseManualDiscount1();

            },
            onDeleteManualDiscount1: function (oEvent) {

                var bflag = false;
                var oModel = this.getView().getModel("discountModelTable"); // Get the JSON model
                var aEntries = oModel.getProperty("/entries"); // Get the array from the model
                var oItem = oEvent.getParameter("listItem");
                var oContext = oItem.getBindingContext("discountModelTable");
                var dataObj = oModel.getObject(oContext.sPath);
                var iIndex = oContext.getPath().split("/").pop(); // Extract index
                var matchProdTableIndex = -1;
                var matchDiscTableIndex = -1;
                aEntries.splice(iIndex, 1);
                oModel.refresh();
                var productTblData = this.getView().getModel("ProductModel").getProperty("/Product");
                for (var count = 0; count < productTblData.length; count++) {
                    var discountData = productTblData[count].ToDiscounts.results;
                    for (var count2 = 0; count2 < discountData.length; count2++) {

                        if (dataObj.ItemCode === discountData[count2].ItemCode && dataObj.ConditionName === discountData[count2].ConditionName && dataObj.DiscountType === "M") {
                            bflag = true;
                            matchProdTableIndex = count;
                            matchDiscTableIndex = count2;
                            break;
                        }
                    }
                }
                if (bflag) {
                    this.removeManualDiscount(matchProdTableIndex, productTblData[matchProdTableIndex], dataObj);
                    this.getView().getModel("ProductModel").getProperty("/Product")[matchProdTableIndex].ToDiscounts.results.splice(matchDiscTableIndex, 1);
                }

            },
            checkCashPayment: function () {
                var bFlag = false;
                if (this.aPaymentEntries.length > 0) {
                    for (var count = 0; count < this.aPaymentEntries.length; count++) {

                        if (this.aPaymentEntries[count].PaymentMethodName === "Cash") {
                            bFlag = true;
                            return count;

                        }
                    }
                }

            },
            enableSerialNumber: function (flag) {
                if (flag === "Y" || flag === "X") {
                    return true;
                }
                else {
                    return false;
                }
            },
            onAddPromotion: function (oEvent) {
                var that = this;
                var oView = this.getView();
                var promotionModel = new JSONModel();
                var selectedItem = oEvent.getSource().getBindingContext("ProductModel").getObject();
                var aFilters = [];
                aFilters.push(new sap.ui.model.Filter("Itemcode", sap.ui.model.FilterOperator.EQ, selectedItem.Itemcode));
                this.oModel.read("/PromotionsSet", {
                    filters: aFilters,
                    success: function (oData) {

                        if (oData.results.length > 0) {
                            var results = oData.results;
                            var groupedData = {};
                            results.forEach(function (item) {
                                var key = item.ConditionType;
                                if (!groupedData[key]) {
                                    groupedData[key] = [];
                                }
                                groupedData[key].push(item);
                            });

                            promotionModel.setData(groupedData);
                            that.getView().setModel(promotionModel, "PromotionModel");

                            if (!that._oPromotionFragment) {
                                that._oPromotionFragment = sap.ui.xmlfragment(
                                    oView.getId(),
                                    "com.eros.salesprocess.fragment.promotionFragment",
                                    that
                                );
                                oView.addDependent(that._oPromotionFragment);
                            }

                            // ensure appliedPromotions exists
                            that._appliedPromotions = that._appliedPromotions || {};

                            // get reference of Apply button inside fragment
                            var oApplyBtn = sap.ui.core.Fragment.byId(oView.getId(), "applyPromotionBtn");

                            // check if already applied
                            if (that._appliedPromotions[results[0].Itemcode]) {
                                if (that._appliedPromotions[results[0].Itemcode].length > 0) {
                                    oApplyBtn.setEnabled(false);
                                } else {
                                    oApplyBtn.setEnabled(true);
                                }
                            }
                            else {
                                oApplyBtn.setEnabled(true);
                            }

                            that._oPromotionFragment.open();

                            // Restore previous selection
                            var aApplied = that._appliedPromotions && that._appliedPromotions[selectedItem.Itemcode];
                            if (aApplied) {
                                // ZPM1
                                var oTableZPM1 = that.byId("zpm1PromotionTbl");
                                oTableZPM1.getItems().forEach(function (oRow) {
                                    var oCtx = oRow.getBindingContext("PromotionModel").getObject();
                                    if (aApplied.Material === oCtx.Material) {
                                        oTableZPM1.setSelectedItem(oRow, true);
                                    }
                                });

                                // ZPM2
                                var oTableZPM2 = that.byId("zpm2PromotionTbl");
                                if (Array.isArray(aApplied)) {
                                    oTableZPM2.getItems().forEach(function (oRow) {
                                        var oCtx = oRow.getBindingContext("PromotionModel").getObject();
                                        var bMatch = aApplied.some(function (appliedRow) {
                                            return appliedRow.Material === oCtx.Material;
                                        });
                                        if (bMatch) {
                                            oTableZPM2.setSelectedItem(oRow, true);
                                        }
                                    });
                                }
                            }
                        }
                    }
                    ,
                    error: function (oError) {
                        sap.m.MessageBox.show(
                            JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: ["OK", "CANCEL"],
                            onClose: function (oAction) {

                            }
                        }
                        );


                    }
                });

            },
            onAddProductZPM1: function () {
                var tbl = sap.ui.getCore().byId("zpm1PromotionTbl");

            },
            fnClosePromotion: function () {
                this._oPromotionFragment.close();

            },
            fnApplyPromotion: function () {
                var oTableZPM1 = this.byId("zpm1PromotionTbl");
                var oTableZPM2 = this.byId("zpm2PromotionTbl");
                var oModel = this.getView().getModel("PromotionModel");
                this.bPromoItem = false;

                var aSelectedItemsZPM1 = oTableZPM1.getSelectedItems();
                var aSelectedItemsZPM2 = oTableZPM2.getSelectedItems();
                this._appliedPromotions = this._appliedPromotions || {};

                // If ZPM1 selected → 1 API call
                if (aSelectedItemsZPM1.length > 0) {
                    var oData = aSelectedItemsZPM1[0].getBindingContext("PromotionModel").getObject();
                    this.bPromoItem = true;
                    this.promoCondName = oData.ConditionName;
                    this.promoCondType = oData.ConditionType;
                    this.promoAmount = oData.Promotion;
                    this.promoEntries = {};
                    this.promoEntries = { "Type": this.promoCondType, "Amount": this.promoAmount };
                    this._appliedPromotions[oData.Itemcode] = {
                        "Type": oData.ConditionType,
                        "Amount": oData.Promotion,
                        "Material": oData.Material
                    };

                    this.getMaterialDetail(true, oData.Material, "", this.bPromoItem, this.promoEntries);
                    this._oPromotionFragment.close();

                    return;
                }

                // If ZPM2 selected → Multiple API calls
                if (aSelectedItemsZPM2.length > 0) {
                    var aData = aSelectedItemsZPM2.map(function (oItem) {
                        return oItem.getBindingContext("PromotionModel").getObject();
                    });

                    this._appliedPromotions[aData[0].Itemcode] = aData.map(function (oRow) {
                        return {
                            Type: oRow.ConditionType,
                            Amount: oRow.Promotion,
                            Material: oRow.Material
                        };
                    });

                    aData.forEach(function (oRow) {
                        this.bPromoItem = true;
                        this.promoCondName = oRow.ConditionName;
                        this.promoCondType = oRow.ConditionType;
                        this.promoAmount = oRow.Promotion;
                        this.promoEntries = {};
                        this.promoEntries = { "Type": this.promoCondType, "Amount": this.promoAmount };
                        this.getMaterialDetail(true, oRow.Material, "", this.bPromoItem, this.promoEntries);

                    }.bind(this));
                    this._oPromotionFragment.close();
                    return;
                }

                sap.m.MessageToast.show("Please select a promotion.");
            },




            onZPM1SelectionChange: function (oEvent) {
                var oTableZPM1 = this.byId("zpm1PromotionTbl");
                var oTableZPM2 = this.byId("zpm2PromotionTbl");

                // If something is selected in ZPM1, clear ZPM2 selections
                if (oEvent.getParameter("selected")) {
                    oTableZPM2.removeSelections(true); // 'true' to suppress selectionChange event
                }
            },
            onZPM2SelectionChange: function (oEvent) {
                var oTableZPM1 = this.byId("zpm1PromotionTbl");
                var oTableZPM2 = this.byId("zpm2PromotionTbl");

                // If any item in ZPM2 is selected
                if (oTableZPM2.getSelectedItems().length > 0) {
                    // Clear ZPM1 selections
                    oTableZPM1.removeSelections(true);

                    // Select all rows in ZPM2
                    oTableZPM2.selectAll();
                }
            },
            onCashSubmit: function (oEvent) {

                var cashAmount = sap.ui.getCore().byId("cash").getValue();
                this.paymentEntSourceCounter = this.paymentEntSourceCounter + 1;
                this.paymentId = this.paymentId + 1;
                var bFlag = false;
                var maxcount = "";
                // if (this.aPaymentEntries.length > 0) {
                //     for (var count = 0; count < this.aPaymentEntries.length; count++) {

                //         if (this.aPaymentEntries[count].PaymentMethodName === "Cash") {
                //             bFlag = true;
                //             maxcount = count;
                //             break;

                //         }
                //     }
                // }
                if (cashAmount !== 0 && cashAmount !== "0.00" && cashAmount !== "") {

                    // if (bFlag) {
                    //     this.aPaymentEntries[maxcount].Amount = parseFloat(this.aPaymentEntries[maxcount].Amount) + parseFloat(cashAmount)
                    // }
                    // else {
                    this.aPaymentEntries.push({
                        "TransactionId": this.getView().byId("tranNumber").getCount().toString(),
                        "PaymentId": this.paymentId.toString(),
                        "PaymentDate": new Date(),
                        "Amount": cashAmount.toString(),
                        "Currency": "AED",
                        "PaymentMethod": "011", //Cash( 011), card ("")
                        "PaymentMethodName": "Cash",
                        "Tid": "",
                        "Mid": "",
                        "CardType": "",
                        "CardLabel": "",
                        "CardNumber": "",
                        "AuthorizationCode": "",
                        "CardReceiptNo": "",
                        "PaymentType": "CASH",
                        "VoucherNumber": "",
                        "SourceId": "",
                        "ChangeAmount": "0.00"


                    });
                    //}

                    var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                    var paidAmount = 0;
                    for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                        paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                    }
                    var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                    if (balanceAmount <= 0) {
                        sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                        sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                        sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                        // this.aPaymentEntries.forEach(function (entry) {
                        //     if (entry.PaymentType === "CASH") {
                        //         entry.ChangeAmount = balanceAmount.toString();
                        //     }
                        // });
                        for (var i = this.aPaymentEntries.length - 1; i >= 0; i--) {
                            if (this.aPaymentEntries[i].PaymentType === "CASH") {
                                this.aPaymentEntries[i].ChangeAmount = balanceAmount.toString();
                                break; // Stop after updating the last CASH entry
                            }
                        }
                        oEvent.getSource().setEnabled(false);
                        sap.m.MessageToast.show("Cash Payment Successful");
                        that.onOpenSignaturePad();
                        //that.OnSignaturePress();
                        //that.onPressPaymentTest();
                    }
                    else {
                        sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                        sap.ui.getCore().byId("cash").setValue("");
                        sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        sap.m.MessageToast.show("Cash Payment Successful");
                    }



                    //var tenderChangeAmount = this.getView().byId("totaltenderBal").getValue();

                }
            },
            onAddSerialNumber: function (oEvent) {

                var selIndex = oEvent.getSource().getId().split("--")[2].split("-")[1];
                var selIndexData = this.getView().getModel("ProductModel").getObject("/Product/" + selIndex);
                this.getActualQty = parseInt(selIndexData.SaleQuantity);
                this.serialItemCode = selIndexData.Itemcode;
                this.serialTransItem = selIndexData.Seq;
                this._addSerialNumberDialog = null;
                this._addSerialNumberDialog = sap.ui.xmlfragment(
                    "com.eros.salesprocess.fragment.addSerialNumber",
                    this
                );

                var aExistingSerials = this.serialNumbers.filter(function (item) {
                    return item.itemCode === that.serialItemCode;
                });
                var aRows = [];
                if (aExistingSerials.length > 0) {
                    // Use saved serials
                    if (aExistingSerials.length === this.getActualQty) {
                        aRows = aExistingSerials.map(item => ({
                            serialNumber: item.serialNumber
                        }));
                    }
                    else if (aExistingSerials.length < this.getActualQty) {
                        const diff = this.getActualQty - aExistingSerials.length;
                        for (let i = 0; i < diff; i++) {
                            aExistingSerials.push({ itemCode: aExistingSerials[0].itemCode, serialNumber: '' });
                        }
                        aRows = aExistingSerials.map(item => ({
                            serialNumber: item.serialNumber
                        }));
                    }
                    else if (aExistingSerials.length > this.getActualQty) {

                        aExistingSerials.splice(this.getActualQty, aExistingSerials.length - this.getActualQty);
                        aRows = aExistingSerials.map(item => ({
                            serialNumber: item.serialNumber
                        }));
                    }
                    // else{
                    //     for (var i = 0; i < this.getActualQty; i++) {
                    //     aRows.push({ serialNumber: "" });
                    //     }
                    //     }
                    // aRows.splice(aExistingSerials.length - this.getActualQty );
                } else {
                    // Create empty rows for quantity
                    for (var i = 0; i < this.getActualQty; i++) {
                        aRows.push({ serialNumber: "" });
                    }
                }


                var oSerialModel = new sap.ui.model.json.JSONModel({
                    serials: aRows
                });

                sap.ui.getCore().byId("idSerNumber").setModel(oSerialModel, "serialModel");
                // if (filteredSerials.length > 0) {
                //     for (var i = 0; i < filteredSerials.length; i++) {
                //             oTable[i].getAggregation("cells")[0].setProperty("value", filteredSerials[i].serialNumber);

                //     }
                // }
                this._addSerialNumberDialog.open();
            },
            handleAddWorkOrder: function (tableId) {

                var columnListItemNewLine = new sap.m.ColumnListItem({
                    type: sap.m.ListType.Inactive,
                    cells: [
                        // add created controls to item
                        new sap.m.Input({
                            value: ""

                        })

                    ]
                });
                sap.ui.getCore().byId(tableId).addItem(columnListItemNewLine);

            },
            onPressCancelButton: function () {
                if (this._addSerialNumberDialog) {
                    this._addSerialNumberDialog.destroy(true);
                    this._addSerialNumberDialog = null;
                }
            },
            onSaveSerialNumber: function () {
                var that = this;
                var bflag = false;
                var oTable = sap.ui.getCore().byId("idSerNumber").getItems();

                this.serialNumbers = this.serialNumbers.filter(function (item) {
                    return item.itemCode !== that.serialItemCode;
                });

                for (var i = 0; i < oTable.length; i++) {

                    if (oTable[i].getAggregation("cells")[0].getProperty("value") !== "") {
                        this.serialNumbers.push({
                            "itemCode": this.serialItemCode,
                            "serialNumber": oTable[i].getAggregation("cells")[0].getProperty("value"),
                            "seq": this.serialTransItem
                        });
                    }
                    else {
                        bflag = true;
                        MessageBox.error("Kindly add " + oTable.length + " serial number or this selected item or adjust the quantity");
                        break;
                    }
                }

                var aSerialNumbers = this.serialNumbers;
                var oSerialSet = new Set();
                var bDuplicateFound = false;
                var sDuplicateValue = "";
                for (var i = 0; i < aSerialNumbers.length; i++) {
                    var sSerial = aSerialNumbers[i].serialNumber;

                    // Check if it already exists
                    if (oSerialSet.has(sSerial)) {
                        bDuplicateFound = true;
                        sDuplicateValue = sSerial;
                        break;
                    }
                    oSerialSet.add(sSerial);
                }
                // Show message if duplicate is found
                if (bDuplicateFound) {
                    sap.m.MessageBox.error("Duplicate Serial Number found: " + sDuplicateValue);
                } else {
                    if (!bflag) {
                        this.onPressCancelButton();
                    }
                }


            },
            onProductRowPress: function (oEvent) {
                var that = this;
                var selIndexData = oEvent.getParameter("listItem").getBindingContext("ProductModel").getObject();
                var oItemDetailModel = new sap.ui.model.json.JSONModel({
                    "Location": selIndexData.LocationName,
                    "UnitDiscount": selIndexData.Discount,
                    "GrossDiscount": selIndexData.NetDiscount,
                    "VatAmount": selIndexData.VatAmount,
                    "VatPercent": selIndexData.VatPercent

                });

                if (!that._oDialogItemDetails) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.itemDetail",
                        controller: that
                    }).then(function (oFragment) {
                        that._oDialogItemDetails = oFragment;
                        that.getView().addDependent(that._oDialogItemDetails);
                        sap.ui.getCore().setModel(oItemDetailModel, "itemDataModel");
                        that._oDialogItemDetails.setModel(oItemDetailModel, "itemDataModel");
                        that._oDialogItemDetails.open();
                    }.bind(that));
                } else {
                    that._oDialogItemDetails.setModel(oItemDetailModel, "itemDataModel");
                    sap.ui.getCore().setModel(oItemDetailModel, "itemDataModel");
                    that._oDialogItemDetails.open();
                }
            },
            onCloseItemDetail: function () {
                that._oDialogItemDetails.close();
            },
            fnLiveChangeCmntTxtArea: function (oEvent) {

                if (oEvent.getSource().getValue().length > 0) {
                    this.suspendComments = oEvent.getSource().getValue();
                    sap.ui.getCore().byId("commentsSubm").setEnabled(true);
                }
                else {
                    sap.ui.getCore().byId("commentsSubm").setEnabled(false);
                }
            },
            fnCloseComments: function () {
                that._oDialogSuspComments.close();
            },
            fnSubmitComments: function () {
                this.onPressSuspend();
            },
            openPressSuspendComments: function () {

                if (!that._oDialogSuspComments) {
                    Fragment.load({
                        name: "com.eros.salesprocess.fragment.comments",
                        controller: that
                    }).then(function (oFragment) {
                        that._oDialogSuspComments = oFragment;
                        that.getView().addDependent(that._oDialogSuspComments);
                        that._oDialogSuspComments.open();
                    }.bind(that));
                } else {
                    that._oDialogSuspComments.open();
                }
            },
            onSelectCardType: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem").getBindingContext().getObject();
                this.selectedCardData = oSelectedItem;
                this.selectedCardType = oSelectedItem.CardType;
                this.selectedCardPayMethodName = oSelectedItem.PaymentMethodName;
                this.selectedCardPayMethod = oSelectedItem.PaymentMethod;

                this._oDialogCardType = null;
                if (!this._oDialogCardType) {
                    this._oDialogCardType = new sap.m.Dialog({
                        title: this.selectedCardType,
                        content: [],
                        beginButton: new sap.m.Button({
                            text: "Submit",
                            class: "cstmBtn",
                            press: function () {
                                if (this.validateCardInputs()) {
                                    this.onSubmitCardType(); // call your method only if valid
                                    this._oDialogCardType.close();
                                }
                            }.bind(this)
                        }).addStyleClass("cstmBtn"),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            class: "cstmBtn",
                            press: function () {
                                this._oDialogCardType.close();
                            }.bind(this)
                        }).addStyleClass("cstmBtn")
                    }).addStyleClass("customerDialog");
                    this._oAmountCardInput = new sap.m.Input({
                        placeholder: "Enter Amount",
                        type: "Number",
                        width: "60%",
                        change: this.validateEnterAmount.bind(this)
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oSelectCardLabel = new sap.m.Input({
                        placeholder: "Enter Card Label",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oSelectCardApproval = new sap.m.Input({
                        placeholder: "Enter Approval Code",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oSelectCardReciept = new sap.m.Input({
                        placeholder: "Enter Card Reciept Number",
                        width: "60%"
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oDialogCardType.addContent(this._oAmountCardInput);
                    this._oDialogCardType.addContent(this._oSelectCardLabel);
                    this._oDialogCardType.addContent(this._oSelectCardApproval);
                    this._oDialogCardType.addContent(this._oSelectCardReciept);
                    this.getView().addDependent(this._oDialogCardType);
                }

                // Clear previous input
                this._oAmountCardInput.setValue("");
                this._oSelectCardLabel.setValue("");
                this._oSelectCardApproval.setValue("");
                this._oSelectCardReciept.setValue("");

                this._oDialogCardType.open();
                // sap.ui.getCore().byId("manCardAmount").setValue("");
                // sap.ui.getCore().byId("manCardNumber").setValue("");
                // sap.ui.getCore().byId("manCardApproveCode").setValue("");
                // sap.ui.getCore().byId("manCardReciept").setValue("");
            },
            validateCardInputs: function () {
                var isValid = true;

                // Amount field
                if (!this._oAmountCardInput.getValue()) {
                    this._oAmountCardInput.setValueState("Error");
                    this._oAmountCardInput.setValueStateText("Amount is required");
                    isValid = false;
                } else {
                    if (parseFloat(this._oAmountCardInput.getValue()) <= parseFloat(sap.ui.getCore().byId("totalSaleBalText").getText())) {
                        this._oAmountCardInput.setValueState("None");
                    }
                    else {
                        isValid = false;
                        this._oAmountCardInput.setValueState("Error");
                        sap.m.MessageBox.error("Entered Amount is more than Sale Amount");
                    }

                }

                // Card Label
                if (!this._oSelectCardLabel.getValue()) {
                    this._oSelectCardLabel.setValueState("Error");
                    this._oSelectCardLabel.setValueStateText("Card Label is required");
                    isValid = false;
                } else {
                    this._oSelectCardLabel.setValueState("None");
                }

                // Approval Code
                if (!this._oSelectCardApproval.getValue()) {
                    this._oSelectCardApproval.setValueState("Error");
                    this._oSelectCardApproval.setValueStateText("Approval Code is required");
                    isValid = false;
                } else {
                    this._oSelectCardApproval.setValueState("None");
                }

                // Receipt Number
                if (!this._oSelectCardReciept.getValue()) {
                    this._oSelectCardReciept.setValueState("Error");
                    this._oSelectCardReciept.setValueStateText("Receipt Number is required");
                    isValid = false;
                } else {
                    this._oSelectCardReciept.setValueState("None");
                }

                return isValid;
            },

            validateEnterAmount: function (oEvent) {
                if (parseFloat(oEvent.getSource().getValue()) > parseFloat(sap.ui.getCore().byId("totalSaleBalText").getText())) {
                    sap.m.MessageToast.show("Entered Value is more than Sale Balance");
                    oEvent.getSource().setValue("");
                }

            },
            onSubmitCardType: function () {
                var that = this;
                var sAmount = that._oAmountCardInput.getValue();
                var sCardLabel = that._oSelectCardLabel.getValue();
                var sCardApproval = that._oSelectCardApproval.getValue();
                var sCardReciept = that._oSelectCardReciept.getValue();
                that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                that.paymentId = that.paymentId + 1;

                if (!sAmount) {
                    sap.m.MessageToast.show("Please enter an amount");
                    return;
                }
                if (!sCardLabel) {
                    sap.m.MessageToast.show("Please enter Card Label");
                    return;
                }
                if (!sCardApproval) {
                    sap.m.MessageToast.show("Please enter Card Approval Code");
                    return;
                }
                if (!sCardReciept) {
                    sap.m.MessageToast.show("Please enter Card Reciept Number");
                    return;
                }

                that.aPaymentEntries.push({
                    "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                    "PaymentId": that.paymentId.toString(),
                    "PaymentDate": new Date(),
                    "Amount": sAmount.toString(),
                    "Currency": "AED",
                    "PaymentMethod": that.selectedCardPayMethod,
                    "PaymentMethodName": that.selectedCardPayMethodName,
                    "Tid": "",
                    "Mid": "",
                    "CardType": "",
                    "CardLabel": "",
                    "CardNumber": "",
                    "AuthorizationCode": "",
                    "CardReceiptNo": "",
                    "PaymentType": "CARD",
                    "VoucherNumber": "",
                    "SourceId": "",
                    "ChangeAmount": "0.00"


                });

                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                if (balanceAmount <= 0) {
                    sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                    sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                    sap.m.MessageToast.show("Manual Card Payment Successful");
                    that.onOpenSignaturePad();
                    // that.OnSignaturePress();
                    //that.onPressPaymentTest();
                }
                else {
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                    sap.ui.getCore().byId("cash").setValue("");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                    sap.m.MessageToast.show("Manual Card Payment Successful");
                }
                this._oDialogCardType.close();

            },
            onRedeemBounze: function (oEvent) {
                var oSelectedItem = that.getView().getModel("BounzeModel").getData();

                if (oSelectedItem.PointBalance === "0" && oSelectedItem.AccountStatus === "inactive") {
                    sap.m.MessageBox.error("Kindly make sure account should be active and have Points to redeem");
                }
                else {
                    this.onOpenRedeemDialog();
                }
            },
            onOpenRedeemDialog: function () {
                if (!this._oRedeemDialog) {
                    // Create the dialog only once
                    this._oRedeemDialog = new sap.m.Dialog({
                        title: "Redeem Points",
                        contentWidth: "300px",
                        contentHeight: "300px",
                        content: [
                            new sap.m.VBox({
                                items: [

                                    new sap.m.Input("idPointsInput", {
                                        type: sap.m.InputType.Number,
                                        width: "80%",
                                        placeholder: "Enter Points to Redeem",
                                        liveChange: this.onPointsLiveChange.bind(this)
                                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle"),

                                    new sap.m.Label("lblRedeemedAmt", { text: "Redeemed Amount", visible: false, design: "Bold" }).addStyleClass("sapUiSmallMarginBegin cashierLogin sapUiSmallMarginTop "),
                                    new sap.m.Input("inpRedeemedAmt", {
                                        visible: false,
                                        editable: false,
                                        width: "80%",
                                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle"),

                                    new sap.m.Label("idOTPLabel", { text: "Enter OTP", visible: false, design: "Bold" }).addStyleClass("sapUiSmallMarginBegin cashierLogin sapUiSmallMarginTop "),
                                    new sap.m.Input("idOTPInput", {
                                        placeholder: "Enter OTP",
                                        visible: false,
                                        liveChange: this.onEnableSubmitBtn.bind(this),
                                        width: "80%",
                                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle")
                                ]
                            })
                        ],
                        buttons: [
                            new sap.m.Button("redeemBtn", {
                                text: "Redeem",
                                enabled: false,
                                visible: true,
                                press: this.onRedeemPoints.bind(this)
                            }).addStyleClass("cstmBtn"),
                            new sap.m.Button("idSubmitBtn", {
                                text: "Submit",
                                visible: false,
                                press: this.onSubmitOTP.bind(this)
                            }).addStyleClass("cstmBtn"),
                            new sap.m.Button({
                                text: "Close",
                                press: function () {
                                    this._oRedeemDialog.close();
                                }.bind(this)
                            }).addStyleClass("cstmBtn")
                        ]
                    });

                    this.getView().addDependent(this._oRedeemDialog);
                }

                this._oRedeemDialog.open();
            },
            onPointsLiveChange: function (oEvent) {
                var sValue = oEvent.getParameter("value");
                var oRedeemBtn = sap.ui.getCore().byId("redeemBtn");

                // Check if value is a positive number
                var bEnable = /^\d+$/.test(sValue) && parseInt(sValue) > 0;
                oRedeemBtn.setEnabled(bEnable);
            },
            onEnableSubmitBtn: function (oEvent) {
                sap.ui.getCore().byId("idSubmitBtn").setVisible(true);
            },
            onRedeemPoints: function () {
                var that = this;
                let sPoints = sap.ui.getCore().byId("idPointsInput").getValue();
                var oSelectedItem = that.getView().getModel("BounzeModel").getData();

                if (parseInt(sPoints) > parseInt(oSelectedItem.PointBalance)) {
                    sap.m.MessageToast.show("Entered Points should be equal or less than Point balance");
                    return;
                }

                var data = {
                    "MobileNumber": this.getView().getModel("custAddModel").getData().Mobile,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "StoreId": that.storeID,
                    "Points": parseInt(sPoints).toString(),
                    "Amount": "0.00",
                    "LockPointId": ""
                }

                this.oModel.create("/BounzLockPointSet", data, {
                    success: function (oData, response) {
                        that.point = oData.Points;
                        that.lockId = oData.LockPointId;
                        that.redeemAmount = oData.Amount;
                        sap.ui.getCore().byId("idOTPInput").setVisible(true);
                        sap.ui.getCore().byId("idOTPLabel").setVisible(true);
                        sap.ui.getCore().byId("redeemBtn").setVisible(false);
                        sap.ui.getCore().byId("lblRedeemedAmt").setVisible(true);
                        sap.ui.getCore().byId("inpRedeemedAmt").setValue(that.redeemAmount);
                        sap.ui.getCore().byId("inpRedeemedAmt").setVisible(true);


                        sap.m.MessageToast.show("OTP sent to your registered mobile.");
                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });

                    }
                });


            },

            onSubmitOTP: function () {
                var that = this;
                let sOTP = sap.ui.getCore().byId("idOTPInput").getValue();

                var data = {
                    "MobileNumber": this.getView().getModel("custAddModel").getData().Mobile,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "Otp": sOTP,
                    "StoreId": that.storeID,
                    "InvoiceNumber": that.getView().byId("tranNumber").getCount().toString(),
                    "Points": that.point,
                    "Amount": that.redeemAmount,
                    "LockId": that.lockId,
                    "TransactionId": that.getView().byId("tranNumber").getCount().toString()
                }

                this.oModel.create("/BounzRedemptionSet", data, {
                    success: function (oData, response) {
                        that.paymentId = that.paymentId + 1;

                        that.aPaymentEntries.push({
                            "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                            "PaymentId": that.paymentId.toString(),
                            "PaymentDate": new Date(),
                            "Amount": that.redeemAmount,
                            "Currency": "AED",
                            "PaymentMethod": "044",
                            "PaymentMethodName": "Bounz Points Redemption",
                            "Tid": "",
                            "Mid": "",
                            "CardType": "",
                            "CardLabel": "",
                            "CardNumber": "",
                            "AuthorizationCode": "",
                            "CardReceiptNo": "",
                            "PaymentType": "BOUNZ",
                            "VoucherNumber": "",
                            "SourceId": "",
                            "ChangeAmount": "0.00"


                        });

                        var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                        var paidAmount = 0;
                        for (var count1 = 0; count1 < that.aPaymentEntries.length; count1++) {

                            paidAmount = parseFloat(parseFloat(that.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                        }
                        var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                        if (balanceAmount <= 0) {
                            sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                            sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                            sap.ui.getCore().byId("sbmtTrans").setVisible(true);

                            that.onOpenSignaturePad();
                            //that.OnSignaturePress();
                            // that.onPressPaymentTest();
                        }
                        else {
                            sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));

                            sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        }
                        if (that._oRedeemDialog) {
                            that._oRedeemDialog.close();
                        }
                        sap.m.MessageToast.show("Redeemed Succeessfully");

                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });

                    }
                });
            },

            onSelectNonGV: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem").getBindingContext().getObject();
                this._oSelectedReason = oSelectedItem; // Store the clicked item globally
                this.nonGVPaymentMethod = oSelectedItem.PaymentMethod;
                this.nonGVPaymentMethodName = oSelectedItem.PaymentMethodName;
                var bFlag = true;
                if (oSelectedItem.Validate === "X") {
                    bFlag = false;
                }

                this._oDialogNonGV = null;
                if (!this._oDialogNonGV) {
                    this._oDialogNonGV = new sap.m.Dialog({
                        title: this.nonGVPaymentMethodName,
                        content: [],
                        beginButton: new sap.m.Button({
                            text: "Submit",
                            class: "cstmBtn",
                            press: this.onSubmitAmount.bind(this)
                        }).addStyleClass("cstmBtn"),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            class: "cstmBtn",
                            press: function () {
                                this._oDialogNonGV.close();
                            }.bind(this)
                        }).addStyleClass("cstmBtn")
                    }).addStyleClass("customerDialog");
                    this._oAmountInput = new sap.m.Input({
                        placeholder: "Enter Amount",
                        type: "Number",
                        width: "60%",
                        change: this.validateEnterAmount.bind(this)
                    }).addStyleClass("sapUiSmallMarginBegin  sapUiSmallMarginTop sapUiSmallMarginBottom inputStyle");

                    this._oVoucherNumber = new sap.m.TextArea({ placeholder: "Enter Voucher Number", type: "Number", width: "60%" }).addStyleClass("sapUiSmallMarginBegin sapUiTinyMarginTop sapUiSmallMarginBottom inputStyle");



                    this._oDialogNonGV.addContent(this._oAmountInput);
                    this._oDialogNonGV.addContent(this._oVoucherNumber);
                    this.getView().addDependent(this._oDialogNonGV);
                }

                // Clear previous input
                this._oAmountInput.setValue("");
                this._oVoucherNumber.setValue("");

                if (!bFlag) {
                    this._oAmountInput.setEnabled(false);
                    this._oDialogNonGV.getBeginButton().setText("Validate");

                } else {
                    this._oAmountInput.setEnabled(true);
                    this._oDialogNonGV.getBeginButton().setEnabled(true);
                    this._oDialogNonGV.getBeginButton().setText("Submit");

                }

                this._oDialogNonGV.open();
            },


            onSubmitAmount: function (oEvent) {

                var that = this;
                var sAmount = that._oAmountInput.getValue();
                var sVoucherNumber = that._oVoucherNumber.getValue();
                if (oEvent.getSource().getText() === "Validate") {

                    if (!sVoucherNumber) {
                        sap.m.MessageToast.show("Please enter Voucher Number");
                        return;
                    }
                    this.onValidateAdvReciept(oEvent, "N", sVoucherNumber);
                }
                else {
                    that.paymentId = that.paymentId + 1;
                    that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;

                    if (!sAmount) {
                        sap.m.MessageToast.show("Please enter an amount");
                        return;
                    }
                    if (!sVoucherNumber) {
                        sap.m.MessageToast.show("Please enter Voucher Number");
                        return;
                    }

                    that.aPaymentEntries.push({
                        "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                        "PaymentId": that.paymentId.toString(),
                        "PaymentDate": new Date(),
                        "Amount": sAmount.toString(),
                        "Currency": "AED",
                        "PaymentMethod": that.nonGVPaymentMethod,
                        "PaymentMethodName": that.nonGVPaymentMethodName,
                        "Tid": "",
                        "Mid": "",
                        "CardType": "",
                        "CardLabel": "",
                        "CardNumber": "",
                        "AuthorizationCode": "",
                        "CardReceiptNo": "",
                        "PaymentType": "NEGV",
                        "VoucherNumber": sVoucherNumber,
                        "SourceId": "",
                        "ChangeAmount": "0.00"


                    });

                    var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                    var paidAmount = 0;
                    for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                        paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                    }
                    var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                    if (balanceAmount <= 0) {
                        sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                        sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                        sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                        sap.m.MessageToast.show("Non EGV Payment Successful");
                        that.onOpenSignaturePad();
                        //that.OnSignaturePress();
                        //that.onPressPaymentTest();
                    }
                    else {
                        sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                        sap.ui.getCore().byId("cash").setValue("");
                        sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                        sap.m.MessageToast.show("Non EGV Payment Successful");
                    }
                    this._oDialogNonGV.close();
                }

            },
            onSubmitNonGV: function () {
                var oMultiInput = sap.ui.getCore().byId("multiInput");
                var aTokens = oMultiInput.getTokens();
                var fTotalAmount = 0;

                aTokens.forEach(function (oToken) {
                    var sTokenText = oToken.getText(); // Example: "Reason1 - 500"
                    var aParts = sTokenText.split("-");

                    if (aParts.length === 2) {
                        var sAmt = aParts[1].trim(); // Take second part and remove spaces
                        var fAmt = parseFloat(sAmt);

                        if (!isNaN(fAmt)) {
                            fTotalAmount += fAmt;
                        }
                    }
                });

                // Show total in a MessageToast (you can bind it to a Text field also)
                sap.m.MessageToast.show("Total Amount: " + fTotalAmount);
            },
            onScan: function () {
                var that = this;
                BarcodeScanner.scan(
                    function (mResult) {

                        if (!mResult.cancelled) {
                            that.getMaterialDetail(true, mResult.text, "");
                        }
                    },
                    function (Error) {
                        window.alert("Scanning Failed :" + Error)
                    }
                )

            },
            onScanStockAvailability: function () {
                var that = this;
                BarcodeScanner.scan(
                    function (mResult) {

                        if (!mResult.cancelled) {
                            that.getStockDetail(true, mResult.text);
                        }
                    },
                    function (Error) {
                        window.alert("Scanning Failed :" + Error)
                    }
                )
            },
            onValidateVoucherAdv: function (oEvent) {
                this.btnEvent = oEvent.getSource();
                var advanceReciept = sap.ui.getCore().byId("advPayment").getValue();
                this.onValidateAdvReciept(oEvent, "A", advanceReciept);

            },
            onValidateGiftVoucher: function (oEvent) {
                this.btnEvent = oEvent.getSource();
                var giftVoucher = sap.ui.getCore().byId("giftVoucher").getValue();
                this.onValidateAdvReciept(oEvent, "E", giftVoucher);
            },
            onValidateCreditNote: function (oEvent) {
                this.btnEvent = oEvent.getSource();
                var creditNote = sap.ui.getCore().byId("creditNote").getValue();
                this.onValidateAdvReciept(oEvent, "C", creditNote);
            },
            onValidateAdvReciept: function (oEvent, mode, reciept) {
                var that = this;
                var oModel = new JSONModel();
                var redemMethod = '';
                if (mode === "N") {
                    redemMethod = this.nonGVPaymentMethod;
                }
                this.oModel.read("/RedeemTransactionSet(Transaction='" + reciept + "',RedemptionType='" + mode + "',RedemptionMethod='" + redemMethod + "')", {
                    success: function (oData) {


                        if (mode === "E") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "GiftVoucher");
                            sap.ui.getCore().byId("gvPaymentList").setVisible(true);

                        } else if (mode === "A") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "AdvancePayment");
                            sap.ui.getCore().byId("advncePaymentList").setVisible(true);

                        } else if (mode === "C") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "CreditNote");
                            sap.ui.getCore().byId("creditNoteList").setVisible(true);
                        }
                        else if (mode === "N") {
                            oModel.setData({});
                            oModel.setData(oData);
                            that.getView().setModel(oModel, "NEGVModel");
                            if (!that._oNEGVDialog) {
                                Fragment.load({
                                    id: that.getView().getId(),
                                    name: "com.eros.salesprocess.fragment.negvdetails",
                                    controller: that
                                }).then(function (oDialog) {
                                    that._oNEGVDialog = oDialog;
                                    that.getView().addDependent(that._oNEGVDialog);
                                    that._oNEGVDialog.open();
                                }.bind(that));
                            } else {
                                that._oNEGVDialog.open();
                            }

                        }

                    },
                    error: function (oError) {
                        if (mode === "E") {
                            oModel.setData({});
                            that.getView().setModel(oModel, "GiftVoucher");
                            sap.ui.getCore().byId("gvPaymentList").setVisible(false);

                        } else if (mode === "A") {
                            oModel.setData({});
                            that.getView().setModel(oModel, "AdvancePayment");
                            sap.ui.getCore().byId("advncePaymentList").setVisible(false);

                        } else if (mode === "C") {
                            oModel.setData({});
                            that.getView().setModel(oModel, "CreditNote");
                            sap.ui.getCore().byId("creditNoteList").setVisible(false);
                        }
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });
                    }
                });
            },
            onCloseNEGVVoucherDialog: function () {
                if (this._oNEGVDialog) {
                    this._oNEGVDialog.close();
                }
            },
            onFetchBounzeDetails: function () {
                var that = this;
                var oModel = new JSONModel();
                that.bcode = this.getView().getModel("custAddModel").getData().Code;
                that.bphnNumber = this.getView().getModel("custAddModel").getData().Mobile;
                this.oModel.read("/BounzMemberProfileSet(MobileNumber='" + that.bphnNumber + "',CountryCode='" + that.bcode + "')", {
                    success: function (oData) {

                        oModel.setData(oData);
                        that.getView().setModel(oModel, "BounzeModel");
                        sap.ui.getCore().byId("bounzeDetails").setVisible(true);



                    },
                    error: function (oError) {

                        sap.ui.getCore().byId("bounzeDetails").setVisible(false);
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {
                                if (JSON.parse(oError.responseText).error.message.value === "Member profile not found") {
                                    sap.ui.getCore().byId("registerBounz").setEnabled(true);
                                }
                            }
                        });
                    }
                });
            },
            onBounzRegister: function () {
                var that = this;
                var data = {
                    "MobileNumber": this.getView().getModel("custAddModel").getData().Mobile,
                    "CountryCode": this.getView().getModel("custAddModel").getData().Code,
                    "FirstName": this.getView().getModel("custAddModel").getData().FirstName,
                    "LastName": this.getView().getModel("custAddModel").getData().LastName,
                    "Email": this.getView().getModel("custAddModel").getData().Email,
                    "Dob": "",
                    "StoreId": that.storeID,
                    "Eid": that.cashierID
                }
                var birthDate = sap.ui.getCore().byId("birthDate").getValue();
                if (birthDate) {

                    data.Dob = new Date(this.resolveTimeDifference(new Date(birthDate)));
                }
                else {
                    data.Dob = null;
                }
                this.oModel.create("/BounzRegistrationSet", data, {
                    success: function (oData, response) {

                        sap.m.MessageBox.success("Member Registered Successfully");
                    },
                    error: function (oError) {
                        sap.m.MessageBox.show(JSON.parse(oError.responseText).error.message.value, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });

                    }
                });
            },
            onNegvRedeemGVPayment: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the NEGV Gift Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, that.nonGVPaymentMethod, that.nonGVPaymentMethodName, "NEGV", balanceAmount, "NEGVModel");
                        }
                    }
                });
            },
            onRedeemGVPayment: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the Gift Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, "017", "EROS Gift Voucher", "EGV", balanceAmount, "GiftVoucher");
                        }
                    }
                });



            },
            onRedeemCreditNote: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the Credit Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, "030", "Credit Memo", "CREDIT NOTE", balanceAmount, "CreditNote");
                        }
                    }
                });





            },
            onRedeemAdvPayment: function (oEvent) {
                var that = this;
                that.paymentId = that.paymentId + 1;
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                MessageBox.confirm("Are you sure you want to redeem the Advance Payment Voucher ?", {
                    icon: MessageBox.Icon.Confirmation,
                    title: "Confirmation",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction == "YES") {
                            that.redeemVoucher(that.paymentId, "030", "On-Account Receipt", "ADVANCE PAYMENT", balanceAmount, "AdvancePayment");
                        }
                    }
                });





            },
            redeemVoucher: function (paymentId, paymentMethod, paymentMethodName, paymentType1, balanceAmount, model) {
                var that = this;
                var itemData = this.getView().getModel(model).getData();
                var balanceAmt = 0;
                if (itemData.RedemptionType === "E") {
                    if (parseFloat(balanceAmount) > parseFloat(itemData.BalanceAmount)) {
                        balanceAmt = itemData.BalanceAmount;
                    }
                    else {
                        balanceAmt = balanceAmount;
                    }

                }
                else {
                    balanceAmt = balanceAmount;
                }
                var redemMethod = '';
                if (paymentType1 === "NEGV") {
                    redemMethod = this.nonGVPaymentMethod;
                }
                var oPayload = {
                    "Transaction": itemData.Transaction,
                    "RedemptionType": itemData.RedemptionType,
                    "ToBeRedeemedAmount": balanceAmt,
                    "Currency": itemData.Currency,
                    "RedeemedAmount": itemData.RedeemedAmount,
                    "BalanceAmount": itemData.BalanceAmount,
                    "TransactionAmount": itemData.TransactionAmount,
                    "RedemptionMethod": redemMethod


                }
                if (parseFloat(itemData.BalanceAmount) < parseFloat(balanceAmt)) {
                    oPayload.ToBeRedeemedAmount = itemData.BalanceAmount;
                }

                this.oModel.create("/RedeemTransactionSet", oPayload, {
                    success: function (oData) {
                        if (oData) {
                            that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                            that.aPaymentEntries.push({
                                "TransactionId": that.getView().byId("tranNumber").getCount().toString(),
                                "PaymentId": that.paymentId.toString(),
                                "PaymentDate": new Date(),
                                "Amount": oPayload.ToBeRedeemedAmount.toString(),
                                "Currency": "AED",
                                "PaymentMethod": paymentMethod,
                                "PaymentMethodName": paymentMethodName,
                                "Tid": "",
                                "Mid": "",
                                "CardType": "",
                                "CardLabel": "",
                                "CardNumber": "",
                                "AuthorizationCode": "",
                                "CardReceiptNo": "",
                                "PaymentType": paymentType1,
                                "VoucherNumber": oData.Transaction,
                                "SourceId": "",
                                "ChangeAmount": "0.00"


                            });
                        }

                        if (paymentType1 === "EGV") {
                            that.updateBalanceAmount("Gift Voucher", "GiftVoucher");
                        }
                        if (paymentType1 === "CREDIT NOTE") {
                            that.updateBalanceAmount("Credit Voucher", "CreditNote");

                        }
                        if (paymentType1 === "ADVANCE PAYMENT") {
                            that.updateBalanceAmount("Advance Reciept", "AdvancePayment");
                        }
                        if (paymentType1 === "NEGV") {
                            that.updateBalanceAmount("Gift Voucher", "NEGV");
                        }
                    },
                    error: function (oError) {
                        var errMessage = "";
                        that.paymentEntSourceCounter = that.paymentEntSourceCounter + 1;
                        if (JSON.parse(oError.responseText).error.message.value) {
                            errMessage = JSON.parse(oError.responseText).error.message.value;
                        }
                        else {
                            errMessage = "Error During Payment Transaction "
                        }

                        sap.m.MessageBox.show(errMessage, {
                            icon: sap.m.MessageBox.Icon.Error,
                            title: "Error",
                            actions: [MessageBox.Action.OK],
                            onClose: function (oAction) {

                            }
                        });

                    }
                });




            },
            onLiveChange: function (oEvent) {
                var oInput = oEvent.getSource();
                var sRawValue = oInput.getFocusDomRef().value;
                var sSanitized = sRawValue.replace(/[^0-9.]/g, ""); // Allow only digits
                oInput.setValue(sSanitized);
            },
            updateBalanceAmount: function (msg, modelName) {
                var that = this;
                var saleAmount = sap.ui.getCore().byId("totalAmountText").getText();
                var paidAmount = 0;
                for (var count1 = 0; count1 < this.aPaymentEntries.length; count1++) {

                    paidAmount = parseFloat(parseFloat(this.aPaymentEntries[count1].Amount) + parseFloat(paidAmount)).toFixed(2);

                }
                var balanceAmount = parseFloat(parseFloat(saleAmount).toFixed(2) - parseFloat(paidAmount).toFixed(2)).toFixed(2);
                if (balanceAmount <= 0) {
                    sap.ui.getCore().byId("totaltenderBal").setText(balanceAmount);
                    sap.ui.getCore().byId("totalSaleBalText").setText("0.00");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(true);
                    sap.m.MessageToast.show(msg + " Redeemed Successfully");
                    that.onOpenSignaturePad();
                    //that.OnSignaturePress();
                    //that.onPressPaymentTest();
                }
                else {
                    sap.ui.getCore().byId("totalSaleBalText").setText(parseFloat(Math.abs(balanceAmount)).toFixed(2));
                    sap.ui.getCore().byId("cash").setValue("");
                    sap.ui.getCore().byId("sbmtTrans").setVisible(false);
                    sap.m.MessageToast.show(msg + " Redeemed Successfully");
                }
                if (that.getView().getModel(modelName)) {
                    that.getView().getModel(modelName).setData({});
                }

                if (modelName === "GiftVoucher") {
                    sap.ui.getCore().byId("giftVoucher").setValue("");
                    sap.ui.getCore().byId("gvPaymentList").setVisible(false);
                }
                else if (modelName === "CreditNote") {
                    sap.ui.getCore().byId("creditNote").setValue("");
                    sap.ui.getCore().byId("creditNoteList").setVisible(false);

                } else if (modelName === "AdvancePayment") {
                    sap.ui.getCore().byId("advPayment").setValue("");
                    sap.ui.getCore().byId("advncePaymentList").setVisible(false);
                }
                else if (modelName === "NEGV") {
                    if (this._oDialogNonGV) {
                        this._oDialogNonGV.close();
                    }
                    if (this._oNEGVDialog) {
                        this._oNEGVDialog.close();
                    }


                }
            },
            // onSave: function () {
            //     var that = this,
            //         token,
            //         dataUrl,
            //         oSvg = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").getSVGString(),
            //         oSvgCash = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePadCash").getSVGString();
            //     this.oPaySignatureload = [];
            //     // oName = sap.ui.core.Fragment.byId(this.getView().getId(), "idName").getValue(),
            //     // oStaff = sap.ui.core.Fragment.byId(this.getView().getId(), "idStaff").getValue(),
            //     // oComments = sap.ui.core.Fragment.byId(this.getView().getId(), "idComments").getValue();

            //     if (!oSvg.includes('d=') || !oSvgCash.includes('d=')) {
            //         MessageBox.error('Signature is required');
            //         return false;
            //     }
            //     const svgBlob = new Blob([oSvg], {
            //         type: 'image/svg+xml'
            //     });
            //     const svgObjectUrl = globalThis.URL.createObjectURL(svgBlob);
            //     const img = document.createElement('img');

            //     const onImageLoaded = () => {
            //         const canvas = document.createElement('canvas');
            //         //canvas.width="350";
            //         //canvas.height="100";
            //         const context = canvas.getContext('2d');
            //         const createdImage = document.createElement('img');

            //         context.drawImage(img, 0, 0);
            //         createdImage.src = canvas.toDataURL('image/bmp');
            //         //binary code
            //         var oArray = (createdImage.src).split(";base64,")[1];
            //         var raw = window.atob(oArray);
            //         var rawLength = raw.length;
            //         var array = new Uint8Array(new ArrayBuffer(rawLength));
            //         for (var i = 0; i < rawLength; i++) {
            //             array[i] = raw.charCodeAt(i);
            //         }

            //         this.oPaySignatureload.push({
            //             "TransactionId": this.getView().byId("tranNumber").getCount(),
            //             "Value": oArray,
            //             "Mimetype": 'image/bmp',
            //             "SignType": "S"
            //         })


            //     };

            //     img.addEventListener('load', onImageLoaded);
            //     img.src = svgObjectUrl;



            //     const svgBlobCash = new Blob([oSvgCash], {
            //         type: 'image/svg+xml'
            //     });
            //     const svgObjectUrlCash = globalThis.URL.createObjectURL(svgBlobCash);
            //     const imgCash = document.createElement('img');

            //     const onImageLoadedCash = () => {
            //         const canvasCash = document.createElement('canvas');
            //         //canvas.width="350";
            //         //canvas.height="100";
            //         const contextCash = canvasCash.getContext('2d');
            //         const createdImageCash = document.createElement('img');

            //         contextCash.drawImage(imgCash, 0, 0);
            //         createdImageCash.src = canvasCash.toDataURL('image/bmp');
            //         //binary code
            //         var oArrayCash = (createdImageCash.src).split(";base64,")[1];
            //         var rawCash = window.atob(oArrayCash);
            //         var rawLengthCash = rawCash.length;
            //         var arrayCash = new Uint8Array(new ArrayBuffer(rawLengthCash));
            //         for (var j = 0; j < rawLengthCash; j++) {
            //             arrayCash[j] = rawCash.charCodeAt(j);
            //         }

            //         this.oPaySignatureload.push({
            //             "TransactionId": this.getView().byId("tranNumber").getCount(),
            //             "Value": oArrayCash,
            //             "Mimetype": 'image/bmp',
            //             "SignType": "C"
            //         })


            //     };

            //     imgCash.addEventListener('load', onImageLoadedCash);
            //     imgCash.src = svgObjectUrlCash;
            //     that._pAddRecordDialog.then(
            //         function (oValueHelpDialog) {
            //             that.onClear();
            //             oValueHelpDialog.setBusy(true);
            //         }.bind(that)
            //     );
            //     setTimeout(function () {
            //         that.onPressPayment(true);
            //     }, 1000)


            // }
            onSave: function () {
                var that = this;
                this.oPaySignatureload = [];
                var oSvg = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePad").getSignature(),
                    oSvgCash = sap.ui.core.Fragment.byId(this.getView().getId(), "idSignaturePadCash").getSignature();

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": oSvg.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "S"
                })

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": oSvgCash.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "C"
                })

                that._pAddRecordDialog.then(
                    function (oValueHelpDialog) {
                        oValueHelpDialog.setBusy(true);
                    }.bind(that)
                );
                setTimeout(function () {
                    that.onPressPayment(true);
                }, 1000)

            },
            onClearSignature: function () {


                const oCanvasControl1 = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas1");
                const canvas1 = oCanvasControl1.getDomRef();
                const ctx1 = canvas1.getContext("2d");
                ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
            },
            onClearCashierSignature: function () {
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas");
                const canvas = oCanvasControl.getDomRef();
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            },

            onSaveSignature: function () {
                var that = this;
                this.oPaySignatureload = [];
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas");
                const canvas = oCanvasControl.getDomRef();
                const imageData = canvas.toDataURL("image/png"); // base64 format
                // You can now send this to backend or store it
                console.log("Signature Base64:", imageData);

                const oCanvasControl1 = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas1");
                const canvas1 = oCanvasControl1.getDomRef();
                const imageData1 = canvas1.toDataURL("image/png"); // base64 format
                // You can now send this to backend or store it
                console.log("Signature Base64:", imageData1);

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": imageData.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "S"
                })

                this.oPaySignatureload.push({
                    "TransactionId": this.getView().byId("tranNumber").getCount(),
                    "Value": imageData1.split("data:image/png;base64,")[1],
                    "Mimetype": 'image/png',
                    "SignType": "C"
                })


                that._pAddRecordDialog.setBusy(true);
                setTimeout(function () {
                    that.onPressPayment(true);
                }, 1000)
            },
            getEventPosition: function (e, canvas) {
                let x, y;
                if (e.touches && e.touches.length > 0) {
                    x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
                    y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
                } else {
                    x = e.clientX - canvas.getBoundingClientRect().left;
                    y = e.clientY - canvas.getBoundingClientRect().top;
                }
                return {
                    x,
                    y
                };
            },
            _initializeCanvas: function () {
                this._initializeCanvas1();
                this._initializeCanvas2();
            },
            _initializeCanvas1: function () {
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas");
                if (!oCanvasControl) {
                    console.error("Canvas control not found");
                    return;
                }

                const canvas = oCanvasControl.getDomRef(); // Get actual <canvas> DOM element
                if (!canvas || !canvas.getContext) {
                    console.error("Canvas DOM element not ready or invalid");
                    return;
                }

                const ctx = canvas.getContext("2d");
                let isDrawing = false;

                const getEventPosition = (e) => {
                    let x, y;
                    if (e.touches && e.touches.length > 0) {
                        x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
                        y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
                    } else {
                        x = e.clientX - canvas.getBoundingClientRect().left;
                        y = e.clientY - canvas.getBoundingClientRect().top;
                    }
                    return {
                        x,
                        y
                    };
                };

                const start = (e) => {
                    isDrawing = true;
                    ctx.beginPath();
                    const pos = getEventPosition(e);
                    ctx.moveTo(pos.x, pos.y);
                    e.preventDefault();
                };

                const draw = (e) => {
                    if (!isDrawing) return;
                    const pos = getEventPosition(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    e.preventDefault();
                };

                const end = () => {
                    isDrawing = false;
                };

                canvas.addEventListener("mousedown", start);
                canvas.addEventListener("mousemove", draw);
                canvas.addEventListener("mouseup", end);
                canvas.addEventListener("mouseout", end);

                canvas.addEventListener("touchstart", start, {
                    passive: false
                });
                canvas.addEventListener("touchmove", draw, {
                    passive: false
                });
                canvas.addEventListener("touchend", end);
            },
            _initializeCanvas2: function () {
                const oCanvasControl = sap.ui.core.Fragment.byId("SignaturePad", "signatureCanvas1");
                if (!oCanvasControl) {
                    console.error("Canvas control not found");
                    return;
                }

                const canvas = oCanvasControl.getDomRef(); // Get actual <canvas> DOM element
                if (!canvas || !canvas.getContext) {
                    console.error("Canvas DOM element not ready or invalid");
                    return;
                }

                const ctx = canvas.getContext("2d");
                let isDrawing = false;

                const getEventPosition = (e) => {
                    let x, y;
                    if (e.touches && e.touches.length > 0) {
                        x = e.touches[0].clientX - canvas.getBoundingClientRect().left;
                        y = e.touches[0].clientY - canvas.getBoundingClientRect().top;
                    } else {
                        x = e.clientX - canvas.getBoundingClientRect().left;
                        y = e.clientY - canvas.getBoundingClientRect().top;
                    }
                    return {
                        x,
                        y
                    };
                };

                const start = (e) => {
                    isDrawing = true;
                    ctx.beginPath();
                    const pos = getEventPosition(e);
                    ctx.moveTo(pos.x, pos.y);
                    e.preventDefault();
                };

                const draw = (e) => {
                    if (!isDrawing) return;
                    const pos = getEventPosition(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    e.preventDefault();
                };

                const end = () => {
                    isDrawing = false;
                };

                canvas.addEventListener("mousedown", start);
                canvas.addEventListener("mousemove", draw);
                canvas.addEventListener("mouseup", end);
                canvas.addEventListener("mouseout", end);

                canvas.addEventListener("touchstart", start, {
                    passive: false
                });
                canvas.addEventListener("touchmove", draw, {
                    passive: false
                });
                canvas.addEventListener("touchend", end);
            },
            onOpenSignaturePad: function () {
                if (!this._pAddRecordDialog) {
                    const oContent = sap.ui.xmlfragment(
                        "SignaturePad",
                        "com.eros.salesprocess.fragment.SignaturePads",
                        this
                    );

                    this._pAddRecordDialog = new sap.m.Dialog({
                        title: "Signature Pad",
                        content: [oContent],
                        stretch: true,
                        afterOpen: this._initializeCanvas.bind(this),

                    });

                    this.getView().addDependent(this._pAddRecordDialog);
                }
                var oPrintBox = sap.ui.core.Fragment.byId("SignaturePad", "printBox");
                oPrintBox.setVisible(false);
                this._pAddRecordDialog.open();
            },
            resolveTimeDifference: function (dateTime) {

                if (dateTime !== undefined && dateTime !== null && dateTime !== "") {

                    var offSet = dateTime.getTimezoneOffset();

                    var offSetVal = dateTime.getTimezoneOffset() / 60;

                    var h = Math.floor(Math.abs(offSetVal));

                    var m = Math.floor((Math.abs(offSetVal) * 60) % 60);

                    dateTime = new Date(dateTime.setHours(h, m, 0, 0));
                    return dateTime;

                }

                return null;

            }


        });
    });

